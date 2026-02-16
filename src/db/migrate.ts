import { readFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { hash } from "@node-rs/argon2";
import { getPool } from "./connection";
import { Log } from "../logger";

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  const schemaPath = join(import.meta.dir, "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");

  // Split on semicolons, filter empty statements
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await pool.execute(statement);
  }

  // Additive migrations for existing databases
  const alterMigrations = [
    `ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS hostname VARCHAR(255) NOT NULL DEFAULT '' AFTER hwid`,
    `ALTER TABLE bug_reports ADD COLUMN IF NOT EXISTS os_user VARCHAR(255) NOT NULL DEFAULT '' AFTER hostname`,
    `ALTER TABLE bug_reports ADD INDEX IF NOT EXISTS idx_hostname (hostname)`,
    `ALTER TABLE bug_reports ADD INDEX IF NOT EXISTS idx_os_user (os_user)`,
    `ALTER TABLE user ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER role`,
  ];

  for (const migration of alterMigrations) {
    try {
      await pool.execute(migration);
    } catch {
      // Column/index already exists — safe to ignore
    }
  }

  // Seed default admin user if user table is empty
  const [rows] = await pool.execute("SELECT COUNT(*) as count FROM `user`");
  const userCount = (rows as Array<{ count: number }>)[0].count;
  if (userCount === 0) {
    const passwordHash = await hash("admin", {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1
    });
    const id = randomUUID();
    await pool.execute(
      "INSERT INTO `user` (`id`, `username`, `password_hash`, `role`) VALUES (?, ?, ?, ?)",
      [id, "admin", passwordHash, "admin"]
    );
    Log("MIGRATE", "Default admin user created (username: admin, password: admin)");
  }

  Log("MIGRATE", "Database migrations completed");
}
