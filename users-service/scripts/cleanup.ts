import { createDatabase } from "../src/modules/users/infrastructure/persistence/connection";
if (!process.env.DATABASE_URL) throw new Error("Configura DATABASE_URL.");
const { pool } = createDatabase(process.env.DATABASE_URL);
try {
  // Mantener historial de rotación hasta después de la caducidad absoluta de la familia.
  const tokens = await pool.query("delete from refresh_tokens where expires_at < now() - interval '1 day'");
  const buckets = await pool.query("delete from rate_limit_buckets where expires_at < now()");
  console.log(JSON.stringify({ event: "expired_auth_data_cleaned", tokens: tokens.rowCount, buckets: buckets.rowCount }));
} catch { console.error(JSON.stringify({ event: "auth_cleanup_failed" })); process.exitCode = 1; }
finally { await pool.end(); }
