import { generateKeyPairSync, randomUUID } from "node:crypto";
import { Usuario } from "../../src/modules/users/domain/user";
import { readConfig } from "../../src/shared/config";
export const secret = "TestPassword123!";
export const now = new Date("2026-10-03T12:00:00Z");
export function user() { return Usuario.register({ userId: `usr_${randomUUID()}`, email: "test@example.com", passwordHash: "hash", profile: { displayName: "Test", avatarUrl: null, preferredLanguage: "es" } }, now).snapshot(); }
export function config() {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  return readConfig({ APP_ENV: "test", DATABASE_URL: "postgresql://unused:unused@127.0.0.1/unused", APP_ORIGIN: "http://127.0.0.1:3001", JWT_PRIVATE_KEY: privateKey, JWT_PUBLIC_KEY: publicKey });
}
