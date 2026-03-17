import { hash } from "@node-rs/argon2";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { randomUUID } from "crypto";
import { getPool } from "../db/connection";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export interface User {
  id: string;
  username: string;
  displayname: string;
  role: "admin" | "user";
  enabled: boolean;
  created_at: Date;
}

export async function listUsers(): Promise<User[]> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, username, displayname, role, enabled, created_at FROM `user` ORDER BY created_at ASC"
  );
  return rows as User[];
}

export async function createUser(data: {
  username: string;
  displayname: string;
  password: string;
  role: "admin" | "user";
}): Promise<User> {
  const pool = getPool();

  // Check for duplicate username
  const [existing] = await pool.execute<RowDataPacket[]>(
    "SELECT id FROM `user` WHERE username = ? LIMIT 1",
    [data.username]
  );
  if ((existing as unknown[]).length > 0) {
    throw new Error("Username already exists");
  }

  const passwordHash = await hash(data.password, ARGON2_OPTIONS);
  const id = randomUUID();

  await pool.execute<ResultSetHeader>(
    "INSERT INTO `user` (id, username, displayname, password_hash, role) VALUES (?, ?, ?, ?, ?)",
    [id, data.username, data.displayname, passwordHash, data.role]
  );

  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, username, displayname, role, enabled, created_at FROM `user` WHERE id = ?",
    [id]
  );
  return (rows as User[])[0];
}

export async function updateUser(
  id: string,
  data: { displayname?: string; enabled?: boolean }
): Promise<boolean> {
  const pool = getPool();

  const fields: string[] = [];
  const params: unknown[] = [];

  if (data.displayname !== undefined) {
    fields.push("displayname = ?");
    params.push(data.displayname);
  }
  if (data.enabled !== undefined) {
    fields.push("enabled = ?");
    params.push(data.enabled);
  }

  if (fields.length === 0) return false;

  params.push(id);
  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE \`user\` SET ${fields.join(", ")} WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

export async function resetPassword(
  id: string,
  newPassword: string
): Promise<boolean> {
  const pool = getPool();
  const passwordHash = await hash(newPassword, ARGON2_OPTIONS);
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE `user` SET password_hash = ? WHERE id = ?",
    [passwordHash, id]
  );
  return result.affectedRows > 0;
}

export async function deleteUser(id: string): Promise<boolean> {
  const pool = getPool();
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM `user` WHERE id = ?",
    [id]
  );
  return result.affectedRows > 0;
}

export async function getUserById(id: string): Promise<User | null> {
  const pool = getPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, username, displayname, role, enabled, created_at FROM `user` WHERE id = ? LIMIT 1",
    [id]
  );
  if ((rows as unknown[]).length === 0) return null;
  return (rows as User[])[0];
}
