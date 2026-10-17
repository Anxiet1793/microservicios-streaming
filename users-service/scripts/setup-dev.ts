import { generateKeyPairSync, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 3072, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const password = randomBytes(24).toString("hex");
const lines = [
  "# Solo desarrollo local; generado sin imprimir secretos.", "APP_ENV=development", "APP_ORIGIN=http://127.0.0.1:3001", "USERS_PORT=3001", "POSTGRES_PORT=5433",
  `POSTGRES_PASSWORD=${password}`, `DATABASE_URL=postgresql://users:${password}@127.0.0.1:5433/users_service`,
  `JWT_PRIVATE_KEY=${JSON.stringify(privateKey)}`, `JWT_PUBLIC_KEY=${JSON.stringify(publicKey)}`,
  "JWT_KEY_ID=users-dev-1", "JWT_ISSUER=users-service", "JWT_AUDIENCE=streaming-services",
  "ACCESS_TOKEN_TTL=900", "REFRESH_TOKEN_TTL=2592000", `SEED_PASSWORD=${randomBytes(24).toString("base64url")}`,
];
try { await writeFile(".env", lines.join("\n") + "\n", { flag: "wx", mode: 0o600 }); console.log(".env de desarrollo creado. La contraseña demo está en SEED_PASSWORD; no se imprime ni se guarda en Git."); }
catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") console.log(".env ya existe; no se ha sobrescrito."); else throw error; }
