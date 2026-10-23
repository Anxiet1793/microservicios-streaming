import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { importPKCS8, SignJWT } from "jose";
import {
  HttpCatalogGateway,
  JwksAuthenticator,
} from "../../src/modules/playback/infrastructure/adapters";
import { storageConfig } from "../support/containers";
// Test-only imports exercise actual producer serialization/signing. No production dependency is added.
import { movie } from "../../../catalog-service/tests/helpers/fixtures";
import { toCatalogTitleDto } from "../../../catalog-service/src/modules/catalog/application/mappers/catalog-dto-mapper";
import { config as usersConfig, user } from "../../../users-service/tests/helpers/fixtures";
import { RsaAccessTokens } from "../../../users-service/src/modules/users/infrastructure/security/tokens";

let body: unknown,
  status = 200,
  hang = false,
  base: string;
const server = createServer((_req, response) => {
  if (hang) return;
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
});
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No contract server port");
  base = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
beforeEach(() => {
  status = 200;
  hang = false;
});

describe("Playback → actual Catalog DTO over HTTP", () => {
  const assetId = `ast_${randomUUID()}`,
    registered = movie({
      playbackReference: { providerId: 1, assetId, manifestKey: `asset:${assetId}` },
    });
  const id = registered.tituloId;
  it.each([1, 2, 3] as const)(
    "interprets publication status %i from the producer DTO",
    async (state) => {
      body = toCatalogTitleDto(
        state === 1
          ? registered
          : state === 2
            ? registered.changePublicationStatus(2, new Date())
            : registered
                .changePublicationStatus(2, new Date())
                .changePublicationStatus(3, new Date()),
      );
      expect(await new HttpCatalogGateway(base).get(id)).toEqual({
        published: state === 2,
        assetId,
      });
    },
  );
  it("handles a producer series with no media reference", async () => {
    const input = movie().snapshot().ficha;
    const { durationMinutes: _duration, ...ficha } = input;
    expect(_duration).toBeGreaterThan(0);
    const series = movie({ typeId: 2, ficha, playbackReference: null });
    body = toCatalogTitleDto(series);
    expect(await new HttpCatalogGateway(base).get(series.tituloId)).toEqual({
      published: false,
      assetId: null,
    });
  });
  it.each([404, 500, 503])("maps upstream HTTP %i without exposing the body", async (code) => {
    status = code;
    body = { error: { message: "private database URI" } };
    await expect(new HttpCatalogGateway(base).get(id)).rejects.toThrow(
      code === 404 ? "TITLE_NOT_FOUND" : "CATALOG_SERVICE_UNAVAILABLE",
    );
  });
  it.each([
    {},
    { tituloId: "wrong", publicationStatusId: 2, playbackReference: null },
    { tituloId: id, publicationStatusId: "2", playbackReference: null },
  ])("rejects incompatible payload %j", async (value) => {
    body = value;
    await expect(new HttpCatalogGateway(base).get(id)).rejects.toThrow(
      "CATALOG_SERVICE_UNAVAILABLE",
    );
  });
  it("does not follow an upstream redirect", async () => {
    status = 302;
    body = {};
    await expect(new HttpCatalogGateway(base).get(id)).rejects.toThrow(
      "CATALOG_SERVICE_UNAVAILABLE",
    );
  });
  it("times out a real stalled HTTP connection", async () => {
    hang = true;
    const start = performance.now();
    await expect(new HttpCatalogGateway(base).get(id)).rejects.toThrow(
      "CATALOG_SERVICE_UNAVAILABLE",
    );
    expect(performance.now() - start).toBeLessThan(6000);
  }, 10000);
  it("treats an opaque legacy catalog reference as unavailable media", async () => {
    body = {
      ...toCatalogTitleDto(registered),
      publicationStatusId: 2,
      playbackReference: { assetId: "legacy-reference" },
    };
    expect(await new HttpCatalogGateway(base).get(id)).toEqual({ published: true, assetId: null });
  });
});

describe("Playback → Users signing and JWKS contract", () => {
  const c = usersConfig(),
    issuer = new RsaAccessTokens(c),
    state = user();
  const request = (token: string) =>
    new Request("http://playback.test/", { headers: { Authorization: `Bearer ${token}` } });
  const authenticator = () =>
    new JwksAuthenticator({
      ...storageConfig(),
      USERS_JWKS_URL: base,
      JWT_ISSUER: c.JWT_ISSUER,
      JWT_AUDIENCE: c.JWT_AUDIENCE,
    });
  async function sign(
    overrides: Record<string, unknown> = {},
    header: Record<string, unknown> = {},
  ) {
    return new SignJWT({
      sub: state.userId,
      userId: state.userId,
      role: "USER",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60,
      jti: randomUUID(),
      iss: c.JWT_ISSUER,
      aud: c.JWT_AUDIENCE,
      ...overrides,
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: c.JWT_KEY_ID, ...header })
      .sign(await importPKCS8(c.JWT_PRIVATE_KEY, "RS256"));
  }
  beforeEach(async () => {
    body = await issuer.jwks();
  });
  it.each(["USER", "ADMIN"] as const)(
    "accepts a real Users %s access token using public JWKS only",
    async (role) => {
      expect(await authenticator().verify(request(await issuer.sign({ ...state, role })))).toEqual({
        userId: state.userId,
        role,
      });
      expect(JSON.stringify(body)).not.toContain('"d":');
    },
  );
  it.each([
    { iss: "wrong" },
    { aud: "wrong" },
    { exp: 1 },
    { sub: `usr_${randomUUID()}` },
    { userId: "forged" },
    { role: "ROOT" },
    { role: ["ADMIN"] },
    { iat: "invalid" },
    { iat: Math.floor(Date.now() / 1000) + 60 },
    { iat: Math.floor(Date.now() / 1000) - 3600 },
    { jti: 42 },
    { jti: "" },
    { jti: undefined },
    { iat: undefined },
    { exp: undefined },
    { nbf: Math.floor(Date.now() / 1000) + 3600 },
  ])("rejects incompatible claims %j", async (overrides) => {
    await expect(authenticator().verify(request(await sign(overrides)))).rejects.toThrow(
      "UNAUTHORIZED",
    );
  });
  it.each([{ kid: "unknown-key" }, { typ: "NOT-JWT" }])(
    "rejects incompatible headers %j",
    async (header) => {
      await expect(authenticator().verify(request(await sign({}, header)))).rejects.toThrow(
        "UNAUTHORIZED",
      );
    },
  );
  it("rejects an invalid signature while retaining the advertised kid", async () => {
    const other = usersConfig();
    const token = await new RsaAccessTokens({ ...other, JWT_KEY_ID: c.JWT_KEY_ID }).sign(state);
    await expect(authenticator().verify(request(token))).rejects.toThrow("UNAUTHORIZED");
  });
  it("rejects a JWKS with invalid RSA key material", async () => {
    body = {
      keys: [{ kty: "RSA", alg: "RS256", use: "sig", kid: c.JWT_KEY_ID, n: "invalid", e: "AQAB" }],
    };
    await expect(authenticator().verify(request(await sign()))).rejects.toThrow("UNAUTHORIZED");
  });
  it("fails closed when the JWKS endpoint is unavailable", async () => {
    status = 503;
    await expect(authenticator().verify(request(await sign()))).rejects.toThrow("UNAUTHORIZED");
  });
  it("rejects unsigned and symmetric algorithm confusion tokens", async () => {
    for (const token of [
      "eyJhbGciOiJub25lIn0.e30.",
      await new SignJWT({ sub: state.userId })
        .setProtectedHeader({ alg: "HS256" })
        .sign(new Uint8Array(32)),
    ])
      await expect(authenticator().verify(request(token))).rejects.toThrow("UNAUTHORIZED");
  });
});
