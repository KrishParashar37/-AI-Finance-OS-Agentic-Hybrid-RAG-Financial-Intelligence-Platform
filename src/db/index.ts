import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsMysqlPool?: mysql.Pool;
};

export const pool =
  globalForDb.__arenaNextJsMysqlPool ??
  mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "test",
    ssl: process.env.DB_HOST?.includes("tidbcloud")
      ? { minVersion: "TLSv1.2", rejectUnauthorized: true }
      : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsMysqlPool = pool;
}

export const db = drizzle(pool);
