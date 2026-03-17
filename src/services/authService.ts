import { hash, verify } from "@node-rs/argon2";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "../db/connection";
import { Log } from "../logger";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

const SESSION_EXPIRY_DAYS = 30;

export interface AuthUser {
  id: string;
  username: string;
  displayname: string;
  role: "admin" | "user";
  enabled: boolean;
}

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function loginUser(
  username: string,
  password: string
): Promise<{ session_id: string; user: AuthUser } | null> {
  const pool = getPool();

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, username, displayname, password_hash, role, enabled FROM `user` WHERE username = ? LIMIT 1",
    [username]
  );

  if ((rows as unknown[]).length === 0) return null;

  const row = rows[0] as {
    id: string;
    username: string;
    displayname: string;
    password_hash: string;
    role: "admin" | "user";
    enabled: boolean;
  };

  const valid = await verify(row.password_hash, password, ARGON2_OPTIONS);
  if (!valid) return null;

  if (!row.enabled) return null;

  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await pool.execute<ResultSetHeader>(
    "INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)",
    [sessionId, row.id, expiresAt]
  );

  Log("AUTH", `User logged in: username=${username} session=${sessionId.slice(0, 8)}...`);

  return {
    session_id: sessionId,
    user: {
      id: row.id,
      username: row.username,
      displayname: row.displayname,
      role: row.role,
      enabled: row.enabled,
    },
  };
}

export async function validateSession(
  sessionId: string
): Promise<AuthUser | null> {
  const pool = getPool();

  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.id, u.username, u.displayname, u.role, u.enabled, s.expires_at
     FROM session s
     JOIN \`user\` u ON u.id = s.user_id
     WHERE s.id = ? LIMIT 1`,
    [sessionId]
  );

  if ((rows as unknown[]).length === 0) return null;

  const row = rows[0] as {
    id: string;
    username: string;
    displayname: string;
    role: "admin" | "user";
    enabled: boolean;
    expires_at: Date;
  };

  if (new Date() > new Date(row.expires_at)) {
    await pool.execute("DELETE FROM session WHERE id = ?", [sessionId]);
    return null;
  }

  if (!row.enabled) return null;

  return {
    id: row.id,
    username: row.username,
    displayname: row.displayname,
    role: row.role,
    enabled: row.enabled,
  };
}

export async function logoutSession(sessionId: string): Promise<void> {
  const pool = getPool();
  await pool.execute("DELETE FROM session WHERE id = ?", [sessionId]);
  Log("AUTH", `Session logged out: ${sessionId.slice(0, 8)}...`);
}
