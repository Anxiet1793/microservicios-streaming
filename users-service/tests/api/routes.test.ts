import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { Dependencies } from "../../src/modules/users/application/ports";
import { Usuario } from "../../src/modules/users/domain/user";
import { config, secret, user } from "../helpers/fixtures";
import {
  RsaAccessTokens,
  OpaqueRefreshTokens,
} from "../../src/modules/users/infrastructure/security/tokens";
import { RateLimitError } from "../../src/modules/users/infrastructure/security/rate-limit";
const injected = vi.hoisted(() => ({ value: {} as unknown }));
vi.mock("../../src/bootstrap/container", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  container: () => injected.value,
}));
import { compose } from "../../src/bootstrap/container";
import * as register from "../../src/app/api/v1/auth/register/route";
import * as login from "../../src/app/api/v1/auth/login/route";
import * as refresh from "../../src/app/api/v1/auth/refresh/route";
import * as logout from "../../src/app/api/v1/auth/logout/route";
import * as me from "../../src/app/api/v1/users/me/route";
import * as password from "../../src/app/api/v1/users/me/change-password/route";
import * as watchlist from "../../src/app/api/v1/users/me/watchlist/route";
import * as watchItem from "../../src/app/api/v1/users/me/watchlist/[tituloId]/route";
import * as preferences from "../../src/app/api/v1/users/me/preferences/route";
import * as preference from "../../src/app/api/v1/users/me/preferences/[tituloId]/route";
import * as health from "../../src/app/api/health/route";
import * as jwks from "../../src/app/.well-known/jwks.json/route";
import type { Handler } from "../../src/shared/http";

const c = config(),
  tokens = new RsaAccessTokens(c),
  titleId = `ttl_${randomUUID()}`;
let state = user(),
  d: Dependencies,
  access: string;
const limiter = { consume: vi.fn() },
  pool = { query: vi.fn() };
async function call(
  handler: Handler,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
  query = "",
  id = titleId,
) {
  return handler(
    new Request(`http://127.0.0.1:3001/api/test${query}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      ...(body !== undefined
        ? { body: typeof body === "string" ? body : JSON.stringify(body) }
        : {}),
    }),
    { params: Promise.resolve({ tituloId: id }) },
  );
}
const auth = () => ({ Authorization: `Bearer ${access}` });
beforeEach(async () => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  state = user();
  access = await tokens.sign(state);
  limiter.consume.mockReset().mockResolvedValue(undefined);
  pool.query.mockReset().mockResolvedValue({ rows: [] });
  d = {
    users: {
      create: vi.fn(async (value) => value),
      findById: vi.fn(async () => state),
      findByEmail: vi.fn(async () => state),
      updateProfile: vi.fn(async (_id, patch, now) =>
        Usuario.restore(state).updateProfile(patch, now).snapshot(),
      ),
      changePassword: vi.fn(async () => true),
    },
    sessions: {
      create: vi.fn(async () => true),
      rotate: vi.fn(async () => ({
        kind: "ok" as const,
        user: state,
        expiresAt: new Date(Date.now() + 60000),
      })),
      revoke: vi.fn(async () => undefined),
    },
    passwords: {
      hash: vi.fn(async () => "argon2-hash-from-port"),
      verify: vi.fn(async (value) => value === secret),
    },
    access: tokens,
    refresh: new OpaqueRefreshTokens(),
    watchlist: {
      add: vi.fn(async (_id, tituloId, now) => ({ tituloId, addedAt: now })),
      remove: vi.fn(async () => undefined),
      list: vi.fn(async (_id, p) => ({ items: [], pagination: { ...p, total: 0, totalPages: 0 } })),
    },
    preferences: {
      set: vi.fn(async (_id, tituloId, value, now) => ({
        tituloId,
        value,
        createdAt: now,
        updatedAt: now,
      })),
      remove: vi.fn(async () => undefined),
      list: vi.fn(async (_id, p) => ({ items: [], pagination: { ...p, total: 0, totalPages: 0 } })),
    },
    now: () => new Date(),
    uuid: randomUUID,
    accessTtl: 900,
    refreshTtl: 86400,
  };
  injected.value = { config: c, access: tokens, cases: compose(d), limiter, pool };
});

describe("Actual Users Route Handlers, crypto real, repository ports controlled", () => {
  it.each([
    { name: "email", body: { email: "invalid", password: secret, displayName: "Test" } },
    { name: "password", body: { email: "a@example.test", password: "short", displayName: "Test" } },
    {
      name: "role injection",
      body: { email: "a@example.test", password: secret, displayName: "Test", role: "ADMIN" },
    },
    {
      name: "empty profile",
      body: { email: "a@example.test", password: secret, displayName: " " },
    },
  ])("rejects invalid registration ($name) without writing", async ({ body }) => {
    const response = await call(register.POST, "POST", body);
    expect(response.status).toBe(400);
    expect(d.users.create).not.toHaveBeenCalled();
  });
  it("registers with 201 without password/hash or a caller-selected role", async () => {
    const response = await call(register.POST, "POST", {
      email: " TEST@example.com ",
      password: secret,
      displayName: "Test",
    });
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.user).toMatchObject({ email: "test@example.com", role: "USER" });
    expect(JSON.stringify(body)).not.toContain("password");
  });
  it("login issues valid claims but exposes refresh only via HttpOnly cookie", async () => {
    const response = await call(login.POST, "POST", { email: state.email, password: secret });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(await tokens.verify(body.accessToken)).toEqual({
      userId: state.userId,
      role: "USER",
      authVersion: 1,
    });
    expect(body).not.toHaveProperty("refreshToken");
    expect(response.headers.get("set-cookie")).toMatch(
      /users_refresh=.+; Path=\/api\/v1\/auth; HttpOnly; SameSite=Strict/,
    );
  });
  it.each(["wrong-password", "missing", "inactive"])(
    "returns generic login error for %s",
    async (mode) => {
      if (mode === "missing") vi.mocked(d.users.findByEmail).mockResolvedValue(null);
      if (mode === "inactive") state.status = "INACTIVE";
      const response = await call(login.POST, "POST", {
        email: state.email,
        password: mode === "wrong-password" ? "wrong" : secret,
      });
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("INVALID_CREDENTIALS");
      expect(d.sessions.create).not.toHaveBeenCalled();
    },
  );
  it.each([
    me.GET,
    me.PATCH,
    password.POST,
    watchlist.GET,
    watchItem.POST,
    watchItem.DELETE,
    preferences.GET,
    preference.PUT,
    preference.DELETE,
  ])("rejects every personal route without identity", async (handler) => {
    const response = await call(handler);
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe("Bearer");
  });
  it.each(["USER", "ADMIN"] as const)(
    "accepts a genuine %s identity without allowing privilege injection",
    async (role) => {
      state.role = role;
      access = await tokens.sign(state);
      const response = await call(me.GET, "GET", undefined, auth());
      expect(response.status).toBe(200);
      expect((await response.json()).role).toBe(role);
    },
  );
  it("rejects a validly signed token whose user no longer exists", async () => {
    vi.mocked(d.users.findById).mockResolvedValue(null);
    expect((await call(me.GET, "GET", undefined, auth())).status).toBe(401);
  });
  it("does not reveal protected profile fields or accept them in PATCH", async () => {
    expect((await call(me.PATCH, "PATCH", { status: "INACTIVE" }, auth())).status).toBe(400);
    expect(d.users.updateProfile).not.toHaveBeenCalled();
    const response = await call(
      me.PATCH,
      "PATCH",
      { displayName: "Updated", avatarUrl: null },
      auth(),
    );
    expect((await response.json()).profile.displayName).toBe("Updated");
    expect(response.status).toBe(200);
  });
  it("lists, adds and idempotently removes references without catalog metadata", async () => {
    expect((await call(watchlist.GET, "GET", undefined, auth(), "?page=2&limit=10")).status).toBe(
      200,
    );
    const added = await call(watchItem.POST, "POST", undefined, auth());
    expect(added.status).toBe(201);
    expect(Object.keys(await added.json()).sort()).toEqual(["addedAt", "tituloId"]);
    expect((await call(watchItem.DELETE, "DELETE", undefined, auth())).status).toBe(204);
    expect((await call(watchItem.DELETE, "DELETE", undefined, auth())).status).toBe(204);
  });
  it.each(["LIKE", "DISLIKE"])("accepts %s and deletes a preference", async (value) => {
    const response = await call(preference.PUT, "PUT", { value }, auth());
    expect(response.status).toBe(200);
    expect((await response.json()).value).toBe(value);
    expect((await call(preferences.GET, "GET", undefined, auth())).status).toBe(200);
    expect((await call(preference.DELETE, "DELETE", undefined, auth())).status).toBe(204);
  });
  it("rejects malformed identifiers, repeated pagination and protected preference fields", async () => {
    expect((await call(watchItem.POST, "POST", undefined, auth(), "", "bad")).status).toBe(400);
    expect((await call(watchlist.GET, "GET", undefined, auth(), "?page=1&page=2")).status).toBe(
      400,
    );
    expect(
      (await call(preference.PUT, "PUT", { value: "LIKE", userId: state.userId }, auth())).status,
    ).toBe(400);
  });
  it("refresh requires CSRF proof, rotates cookie and rejects a reused family", async () => {
    const cookie = `users_refresh=${new OpaqueRefreshTokens().issue().raw}`;
    expect((await call(refresh.POST, "POST", undefined, { Cookie: cookie })).status).toBe(403);
    const headers = { Cookie: cookie, "X-CSRF-Protection": "1" };
    expect((await call(refresh.POST, "POST", undefined, headers)).status).toBe(200);
    vi.mocked(d.sessions.rotate).mockResolvedValue({ kind: "reused" });
    const rejected = await call(refresh.POST, "POST", undefined, headers);
    expect(rejected.status).toBe(401);
    expect(rejected.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("logout clears the cookie and change-password passes through current-credential checks", async () => {
    expect((await call(logout.POST, "POST", undefined, { "X-CSRF-Protection": "1" })).status).toBe(
      204,
    );
    expect(
      (
        await call(
          password.POST,
          "POST",
          { currentPassword: "wrong", newPassword: "NewSafePassword123!" },
          auth(),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await call(
          password.POST,
          "POST",
          { currentPassword: secret, newPassword: "NewSafePassword123!" },
          auth(),
        )
      ).status,
    ).toBe(204);
  });
  it("returns a bounded 429 with Retry-After and never invokes credential hashing", async () => {
    limiter.consume.mockRejectedValue(new RateLimitError(12));
    const response = await call(login.POST, "POST", { email: state.email, password: secret });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
    expect(d.passwords.verify).not.toHaveBeenCalled();
  });
  it("health checks dependencies and JWKS exposes no private key material", async () => {
    expect((await call(health.GET)).status).toBe(200);
    pool.query.mockRejectedValue(new Error("secret database URL"));
    expect((await call(health.GET)).status).toBe(503);
    const response = await call(jwks.GET);
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('"d":');
  });
  it("responds safely to malformed bodies, foreign origin and unsupported methods", async () => {
    expect((await call(login.POST, "POST", "{")).status).toBe(400);
    expect((await call(login.POST, "POST", {}, { Origin: "https://attacker.test" })).status).toBe(
      403,
    );
    const denied = await call(login.GET);
    expect(denied.status).toBe(405);
    expect(denied.headers.get("allow")).toContain("POST");
    expect((await call(login.OPTIONS, "OPTIONS")).status).toBe(204);
    const head = await call(me.HEAD, "HEAD", undefined, auth());
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });
});
