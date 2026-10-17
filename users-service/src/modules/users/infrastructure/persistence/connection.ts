import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
export function createDatabase(url: string) {
  const pool = new pg.Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
  pool.on("error", () => console.error(JSON.stringify({ level: "error", event: "database_pool_error" })));
  return { pool, db: drizzle(pool) };
}
export type Database = ReturnType<typeof createDatabase>["db"];
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;
