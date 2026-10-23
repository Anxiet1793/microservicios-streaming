import { randomUUID } from "node:crypto";
import { Usuario, validatePassword } from "../src/modules/users/domain/user";
import { createDatabase } from "../src/modules/users/infrastructure/persistence/connection";
import { PostgresUserRepository } from "../src/modules/users/infrastructure/persistence/user-repository";
import { Argon2Passwords } from "../src/modules/users/infrastructure/security/passwords";
if (process.env.APP_ENV !== "development")
  throw new Error("El seed solo está permitido con APP_ENV=development.");
if (!process.env.DATABASE_URL || !process.env.SEED_PASSWORD)
  throw new Error("Configura DATABASE_URL y SEED_PASSWORD.");
const password = validatePassword(process.env.SEED_PASSWORD);
const { db, pool } = createDatabase(process.env.DATABASE_URL);
try {
  const repository = new PostgresUserRepository(db);
  const hash = await new Argon2Passwords().hash(password);
  for (const [email, role, displayName] of [
    ["admin@streaming.local", "ADMIN", "Administrador"],
    ["demo@streaming.local", "USER", "Demo"],
  ] as const) {
    if (await repository.findByEmail(email)) continue; // Nunca cambiar roles ni contraseñas de cuentas existentes.
    const user = Usuario.register(
      {
        userId: `usr_${randomUUID()}`,
        email,
        passwordHash: hash,
        profile: { displayName, avatarUrl: null, preferredLanguage: "es" },
      },
      new Date(),
    );
    await repository.create(Usuario.restore({ ...user.snapshot(), role }).snapshot());
  }
  console.log(
    JSON.stringify({
      event: "development_seed_completed",
      accounts: ["admin@streaming.local", "demo@streaming.local"],
    }),
  );
} catch {
  console.error(JSON.stringify({ event: "development_seed_failed" }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
