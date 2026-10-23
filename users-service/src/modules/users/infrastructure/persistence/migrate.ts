import type pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
export async function migrateDatabase(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(81724001)");
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    try {
      await client.query("select pg_advisory_unlock(81724001)");
    } finally {
      client.release();
    }
  }
}
