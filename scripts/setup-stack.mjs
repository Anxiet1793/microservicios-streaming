import { generateKeyPairSync, randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function setupStack(directory = root) {
  const template = await readFile(resolve(directory, ".env.example"), "utf8");
  const keys = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  const generated = {
    POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
    MINIO_ACCESS_KEY: `local-${randomBytes(8).toString("hex")}`,
    MINIO_SECRET_KEY: randomBytes(32).toString("hex"),
    SESSION_SECRET: randomBytes(32).toString("hex"),
    SEED_PASSWORD: `Demo-${randomBytes(24).toString("hex")}`,
    JWT_PRIVATE_KEY: JSON.stringify(keys.privateKey),
    JWT_PUBLIC_KEY: JSON.stringify(keys.publicKey),
  };
  const content = template.replace(/^([A-Z_]+)=.*$/gm, (line, key) =>
    Object.hasOwn(generated, key) ? `${key}=${generated[key]}` : line,
  );
  try {
    // Exclusive creation: never rotate keys/passwords behind persistent volumes.
    await writeFile(resolve(directory, ".env"), content, { flag: "wx", mode: 0o600 });
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    console.log(
      (await setupStack())
        ? "Creado .env raíz con secretos aleatorios. Cuentas demo: SEED_PASSWORD en ese archivo."
        : ".env raíz ya existe; se conserva sin cambios.",
    );
  } catch {
    console.error("No se pudo crear .env raíz; revisa permisos y .env.example.");
    process.exitCode = 1;
  }
}
