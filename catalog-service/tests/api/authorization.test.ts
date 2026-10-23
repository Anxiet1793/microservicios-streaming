import { createServer, type Server } from "node:http";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { exportJWK, importSPKI, SignJWT } from "jose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  requireCatalogAdmin,
  CatalogAuthenticator,
} from "../../src/shared/infrastructure/security/catalog-auth";

const injected = vi.hoisted(() => ({ cases: vi.fn() }));
vi.mock("../../src/bootstrap/catalog-container", () => ({ createCatalogUseCases: injected.cases }));
import { POST } from "../../src/app/api/v1/catalog/bulk/route";
import { PATCH as edit } from "../../src/app/api/v1/catalog/[tituloId]/route";
import { PATCH as publish } from "../../src/app/api/v1/catalog/[tituloId]/publication-status/route";

const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const sub = `usr_${randomUUID()}`;
const context = { params: Promise.resolve({ tituloId: `ttl_${randomUUID()}` }) };
let server: Server;
let url: string;
let jwksStatus = 200;
async function token(
  overrides: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
) {
  return new SignJWT({
    userId: sub,
    role: "ADMIN",
    sub,
    iss: "users-service",
    aud: "streaming-services",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
    jti: randomUUID(),
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "qa", typ: "JWT", ...header })
    .sign(keys.privateKey);
}
function request(raw?: string, method = "POST") {
  return new Request("http://catalog.test/api/v1/catalog/bulk", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(raw === undefined ? {} : { Authorization: `Bearer ${raw}` }),
    },
    body: "{}",
  });
}
beforeAll(async () => {
  const pub = await importSPKI(
    keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
    "RS256",
    { extractable: true },
  );
  const jwks = { keys: [{ ...(await exportJWK(pub)), kid: "qa", alg: "RS256", use: "sig" }] };
  server = createServer((_req, res) => {
    res.writeHead(jwksStatus, { "Content-Type": "application/json" });
    res.end(JSON.stringify(jwks));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No JWKS port");
  url = `http://127.0.0.1:${address.port}/jwks`;
});
beforeEach(() => {
  vi.stubEnv("USERS_JWKS_URL", url);
  vi.stubEnv("JWT_ISSUER", "users-service");
  vi.stubEnv("JWT_AUDIENCE", "streaming-services");
  jwksStatus = 200;
  injected.cases.mockReset();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("Catalog authorization with real RSA signatures and HTTP JWKS", () => {
  it.each([POST, edit, publish])(
    "denies anonymous and USER before parsing or opening MongoDB",
    async (handler) => {
      const anonymous = await handler(
        request(undefined, handler === POST ? "POST" : "PATCH"),
        context,
      );
      expect(anonymous.status).toBe(401);
      expect(anonymous.headers.get("www-authenticate")).toBe("Bearer");
      const denied = await handler(
        request(await token({ role: "USER" }), handler === POST ? "POST" : "PATCH"),
        context,
      );
      expect(denied.status).toBe(403);
      expect(injected.cases).not.toHaveBeenCalled();
    },
  );
  it("accepts ADMIN using the public key only and caches the trusted JWKS", async () => {
    const auth = new CatalogAuthenticator({
      USERS_JWKS_URL: url,
      JWT_ISSUER: "users-service",
      JWT_AUDIENCE: "streaming-services",
    });
    await expect(auth.requireAdmin(request(await token()))).resolves.toBeUndefined();
    jwksStatus = 503;
    await expect(auth.requireAdmin(request(await token()))).resolves.toBeUndefined();
  });
  it.each([
    { role: ["ADMIN"] },
    { iat: "invalid" },
    { iat: Math.floor(Date.now() / 1000) + 60 },
    { iat: Math.floor(Date.now() / 1000) - 3600 },
    { role: "ROOT" },
    { role: null },
    { jti: 123 },
    { jti: "" },
    { sub: "internal-id" },
    { userId: "another-user" },
    { iss: "evil" },
    { aud: "evil" },
    { exp: 1 },
    { iat: undefined },
    { jti: undefined },
    { exp: undefined },
    { nbf: Math.floor(Date.now() / 1000) + 3600 },
  ])("rejects malformed/incompatible claims %j", async (overrides) => {
    const response = await POST(request(await token(overrides)));
    expect(response.status).toBe(401);
    expect(injected.cases).not.toHaveBeenCalled();
  });
  it.each([{ typ: "NOT-JWT" }, { kid: "other" }])(
    "rejects invalid protected headers %j",
    async (header) => {
      expect((await POST(request(await token({}, header)))).status).toBe(401);
    },
  );
  it("rejects bad signatures, unsigned tokens, HS256 and oversized authorization", async () => {
    const signed = await token();
    const parts = signed.split(".");
    parts[2] = Buffer.alloc(256).toString("base64url");
    const symmetric = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .sign(new Uint8Array(32));
    for (const raw of [parts.join("."), "eyJhbGciOiJub25lIn0.e30.", symmetric, "x".repeat(8193)]) {
      expect((await POST(request(raw))).status).toBe(401);
    }
  });
  it("fails closed on JWKS outage and refuses credentialed or non-HTTP key URLs", async () => {
    jwksStatus = 503;
    const auth = new CatalogAuthenticator({
      USERS_JWKS_URL: url,
      JWT_ISSUER: "users-service",
      JWT_AUDIENCE: "streaming-services",
    });
    await expect(auth.requireAdmin(request(await token()))).rejects.toMatchObject({ status: 401 });
    for (const invalid of [
      "file:///keys",
      "https://name:secret@example.invalid/jwks",
      "https://example.invalid/jwks?token=x",
    ]) {
      vi.stubEnv("USERS_JWKS_URL", invalid);
      await expect(requireCatalogAdmin(request(await token()))).rejects.toThrow(
        "Configuración inválida",
      );
    }
  });
});
