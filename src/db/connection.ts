import mysql from "mysql2/promise";
import { config } from "../config";
import { Log } from "../logger";

let pool: mysql.Pool | null = null;

export function getPool(useTestDb?: boolean): mysql.Pool {
  if (!pool) {
    if (useTestDb && config.enableTestDB) {
      Log("db", "using test db");
      return mysql.createPool({
        host: config.testing_mysql.host,
        port: config.testing_mysql.port,
        user: config.testing_mysql.user,
        password: config.testing_mysql.password,
        database: config.testing_mysql.database,
        waitForConnections: true,
        connectionLimit: 10,
        maxIdle: 5,
        idleTimeout: 60000,
      });
    }
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 5,
      idleTimeout: 60000,
    });
  }
  if (useTestDb && config.enableTestDB) {
    Log("db", "using test db");
    return mysql.createPool({
      host: config.testing_mysql.host,
      port: config.testing_mysql.port,
      user: config.testing_mysql.user,
      password: config.testing_mysql.password,
      database: config.testing_mysql.database,
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 5,
      idleTimeout: 60000,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
