import { expect, it } from "vitest";
import SwaggerParser from "@apidevtools/swagger-parser";
import { z } from "zod";
import { authUser, publicUser } from "../../src/modules/users/application/dto";
import { config, user } from "../helpers/fixtures";
import { RsaAccessTokens } from "../../src/modules/users/infrastructure/security/tokens";
import { decodeJwt, decodeProtectedHeader } from "jose";

it("keeps public profile and auth DTOs compatible without leaking credential/internal state", async () => {
  await SwaggerParser.validate("docs/openapi.yaml");
  const state = user();
  const profile = z.strictObject({
    displayName: z.string(),
    avatarUrl: z.url().nullable(),
    preferredLanguage: z.string(),
  });
  const identity = {
    userId: z.string().regex(/^usr_/),
    email: z.email(),
    role: z.enum(["USER", "ADMIN"]),
    status: z.enum(["ACTIVE", "INACTIVE"]),
  };
  expect(
    z
      .strictObject({
        ...identity,
        profile,
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
      })
      .parse(publicUser(state)).userId,
  ).toBe(state.userId);
  expect(
    z.strictObject({ ...identity, displayName: z.string() }).parse(authUser(state)).displayName,
  ).toBe(state.profile.displayName);
  for (const dto of [publicUser(state), authUser(state)])
    for (const field of ["passwordHash", "id", "authVersion"])
      expect(dto).not.toHaveProperty(field);
});
it("publishes stable cross-service RS256 identity, role, audience, TTL and key selection", async () => {
  const c = config(),
    signer = new RsaAccessTokens(c),
    state = user(),
    token = await signer.sign({ ...state, role: "ADMIN" });
  const jwt = decodeJwt(token),
    header = decodeProtectedHeader(token),
    jwks = await signer.jwks();
  expect(jwt).toMatchObject({
    sub: state.userId,
    userId: state.userId,
    role: "ADMIN",
    ver: 1,
    iss: c.JWT_ISSUER,
    aud: c.JWT_AUDIENCE,
  });
  expect(jwt.exp! - jwt.iat!).toBe(c.ACCESS_TOKEN_TTL);
  expect(header).toEqual({ alg: "RS256", kid: c.JWT_KEY_ID, typ: "JWT" });
  expect(jwks.keys[0]).toMatchObject({ kid: header.kid, alg: "RS256", use: "sig", kty: "RSA" });
});
