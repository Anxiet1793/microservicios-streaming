import { describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, jwtVerify, SignJWT, importPKCS8 } from "jose";
import { Argon2Passwords } from "../../src/modules/users/infrastructure/security/passwords";
import {
  OpaqueRefreshTokens,
  RsaAccessTokens,
} from "../../src/modules/users/infrastructure/security/tokens";
import { bearer, checkOrigin, cookie, json, requireRole, route } from "../../src/shared/http";
import { registerSchema, profileSchema } from "../../src/modules/users/interfaces/http/schemas";
import { config, secret, user } from "../helpers/fixtures";
describe("Seguridad", () => {
  it("Argon2id usa sal aleatoria y verifica sin exponer contraseña", async () => {
    const h = new Argon2Passwords();
    const first = await h.hash(secret);
    const second = await h.hash(secret);
    expect(first).toMatch(/^\$argon2id\$v=19\$/);
    expect(first.split("$")[3]!.split(",").sort()).toEqual(["m=19456", "p=1", "t=2"]);
    expect(first).not.toBe(second);
    expect(await h.verify(secret, first)).toBe(true);
    expect(await h.verify("wrong", first)).toBe(false);
    expect(await h.verify(secret, null)).toBe(false);
  });
  it("refresh aleatorio almacenable como SHA-256 y rechaza tokens malformados", () => {
    const codec = new OpaqueRefreshTokens();
    const first = codec.issue();
    expect(first.raw).toHaveLength(43);
    expect(first.hash).toHaveLength(64);
    expect(codec.issue().raw).not.toBe(first.raw);
    expect(codec.hash(first.raw)).toBe(first.hash);
    expect(() => codec.hash("bad")).toThrow();
  });
  it("JWT RS256 se verifica con JWKS sin clave privada ni acceso a base", async () => {
    const c = config();
    const tokens = new RsaAccessTokens(c);
    const u = user();
    const raw = await tokens.sign(u);
    expect(await tokens.verify(raw)).toEqual({ userId: u.userId, role: "USER", authVersion: 1 });
    const jwks = await tokens.jwks();
    expect(JSON.stringify(jwks)).not.toContain('"d":');
    const result = await jwtVerify(raw, createLocalJWKSet(jwks), {
      issuer: c.JWT_ISSUER,
      audience: c.JWT_AUDIENCE,
      algorithms: ["RS256"],
    });
    expect(result.payload.sub).toBe(u.userId);
    await expect(tokens.verify(raw.slice(0, -10) + "aaaaaaaaaa")).rejects.toThrow();
    const key = await importPKCS8(c.JWT_PRIVATE_KEY, "RS256");
    const expired = await new SignJWT({ userId: u.userId, role: "USER", ver: 1 })
      .setSubject(u.userId)
      .setIssuedAt()
      .setJti("test")
      .setIssuer(c.JWT_ISSUER)
      .setAudience(c.JWT_AUDIENCE)
      .setExpirationTime(1)
      .setProtectedHeader({ alg: "RS256", kid: c.JWT_KEY_ID, typ: "JWT" })
      .sign(key);
    await expect(tokens.verify(expired)).rejects.toThrow();
    for (const overrides of [
      { role: ["ADMIN"] },
      { role: "ROOT" },
      { jti: 123 },
      { jti: "" },
      { iat: "invalid" },
      { iat: Math.floor(Date.now() / 1000) + 60 },
      { iat: Math.floor(Date.now() / 1000) - 3600 },
    ] as Record<string, unknown>[]) {
      const malformed = await new SignJWT({
        userId: u.userId,
        role: "USER",
        ver: 1,
        sub: u.userId,
        iat: Math.floor(Date.now() / 1000),
        jti: "qa",
        exp: Math.floor(Date.now() / 1000) + 60,
        iss: c.JWT_ISSUER,
        aud: c.JWT_AUDIENCE,
        ...overrides,
      })
        .setProtectedHeader({ alg: "RS256", kid: c.JWT_KEY_ID, typ: "JWT" })
        .sign(key);
      await expect(tokens.verify(malformed)).rejects.toThrow();
    }
    await expect(
      new RsaAccessTokens({ ...c, JWT_AUDIENCE: "wrong" }).verify(raw),
    ).rejects.toThrow();
  });
  it("protege cookie y exige origen o cabecera CSRF para refresh/logout", () => {
    const c = config();
    expect(
      cookie({ ...c, APP_ENV: "production" }, "token", new Date(Date.now() + 60000)),
    ).toContain("; Secure");
    expect(cookie(c)).toContain("HttpOnly; SameSite=Strict; Max-Age=0");
    expect(() =>
      checkOrigin(
        new Request("http://localhost", { headers: { origin: "https://evil.example" } }),
        c,
        true,
      ),
    ).toThrow();
    expect(() => checkOrigin(new Request("http://localhost"), c, true)).toThrow();
    expect(() =>
      checkOrigin(
        new Request("http://localhost", { headers: { "x-csrf-protection": "1" } }),
        c,
        true,
      ),
    ).not.toThrow();
  });
  it("no permite privilegios aportados en registro o perfil", () => {
    expect(
      registerSchema.safeParse({
        email: "x@example.com",
        password: secret,
        displayName: "X",
        role: "ADMIN",
      }).success,
    ).toBe(false);
    expect(profileSchema.safeParse({ status: "INACTIVE" }).success).toBe(false);
    expect(() =>
      requireRole({ userId: user().userId, role: "USER", authVersion: 1 }, "ADMIN"),
    ).toThrow();
    expect(() => bearer(new Request("http://localhost"))).toThrow();
  });
  it("limita bytes reales y oculta errores y logs sensibles", async () => {
    await expect(
      json(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json", "content-length": "1" },
          body: '"' + "x".repeat(30) + '"',
        }),
        10,
      ),
    ).rejects.toMatchObject({ status: 413 });
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const handler = route("/test", {
      GET: async () => {
        throw new Error("secret password token");
      },
    });
    const response = await handler.GET(new Request("http://localhost/test?password=secret"), {
      params: Promise.resolve({}),
    });
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain("secret");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
    expect(JSON.parse(body).error.requestId).toBe(response.headers.get("x-request-id"));
  });
});
