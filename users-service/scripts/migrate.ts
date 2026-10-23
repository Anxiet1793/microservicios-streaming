import { createDatabase } from "../src/modules/users/infrastructure/persistence/connection";
import { migrateDatabase } from "../src/modules/users/infrastructure/persistence/migrate";
if (!process.env.DATABASE_URL) throw new Error("Configura DATABASE_URL.");
const { pool } = createDatabase(process.env.DATABASE_URL);
try {
  await migrateDatabase(pool);
  console.log(JSON.stringify({ event: "users_migrations_applied" }));
} catch {
  console.error(
    JSON.stringify({
      event: "users_migration_failed",
      message: "Revisar conexión, permisos y migraciones de Users DB.",
    }),
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
