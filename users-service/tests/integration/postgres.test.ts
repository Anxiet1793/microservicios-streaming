import { execFile } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { compose } from "../../src/bootstrap/container";
import type { AccessClaims, Dependencies } from "../../src/modules/users/application/ports";
import { createDatabase } from "../../src/modules/users/infrastructure/persistence/connection";
import { migrateDatabase } from "../../src/modules/users/infrastructure/persistence/migrate";
import { PostgresUserRepository } from "../../src/modules/users/infrastructure/persistence/user-repository";
import { PostgresRefreshTokenRepository } from "../../src/modules/users/infrastructure/persistence/refresh-token-repository";
import { PostgresWatchlistRepository } from "../../src/modules/users/infrastructure/persistence/watchlist-repository";
import { PostgresContentPreferenceRepository } from "../../src/modules/users/infrastructure/persistence/preference-repository";
import { Argon2Passwords } from "../../src/modules/users/infrastructure/security/passwords";
import {
  OpaqueRefreshTokens,
  RsaAccessTokens,
} from "../../src/modules/users/infrastructure/security/tokens";
import { PostgresRateLimiter } from "../../src/modules/users/infrastructure/security/rate-limit";
import { config, secret, user } from "../helpers/fixtures";

const exec = promisify(execFile);
const name = `users-test-${randomUUID()}`;
let started = false;
let database: ReturnType<typeof createDatabase>;
let d: Dependencies;
let cases: ReturnType<typeof compose>;
beforeAll(async () => {
  const password = randomBytes(24).toString("hex");
  await exec(
    "docker",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      name,
      "--publish",
      "127.0.0.1::5432",
      "--env",
      `POSTGRES_PASSWORD=${password}`,
      "--env",
      "POSTGRES_DB=users_test",
      "postgres:17",
    ],
    { timeout: 180000, windowsHide: true },
  );
  started = true;
  const { stdout } = await exec("docker", ["port", name, "5432/tcp"], { windowsHide: true });
  const port = /^127\.0\.0\.1:(\d+)\s*$/.exec(stdout)?.[1];
  if (!port) throw new Error("Puerto de test no encontrado.");
  // URL creada aquí, nunca tomada del entorno o de .env.
  database = createDatabase(`postgresql://postgres:${password}@127.0.0.1:${port}/users_test`);
  for (let attempt = 0; ; attempt++) {
    try {
      await database.pool.query("select 1");
      break;
    } catch {
      if (attempt === 60) throw new Error("Postgres de pruebas no inició.");
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  await migrateDatabase(database.pool);
  const c = config();
  d = {
    users: new PostgresUserRepository(database.db),
    sessions: new PostgresRefreshTokenRepository(database.db),
    watchlist: new PostgresWatchlistRepository(database.db),
    preferences: new PostgresContentPreferenceRepository(database.db),
    passwords: new Argon2Passwords(),
    access: new RsaAccessTokens(c),
    refresh: new OpaqueRefreshTokens(),
    now: () => new Date(),
    uuid: randomUUID,
    accessTtl: 900,
    refreshTtl: 86400,
  };
  cases = compose(d);
});
afterAll(async () => {
  try {
    await database?.pool.end();
  } finally {
    if (started) await exec("docker", ["rm", "--force", name], { windowsHide: true });
  }
});
beforeEach(async () => {
  await database.pool.query(
    "truncate users, profiles, refresh_tokens, watchlist_items, content_preferences, rate_limit_buckets restart identity cascade",
  );
});
async function register(email = "test@example.com") {
  return cases.registerUser.execute({ email, password: secret, displayName: "Test" });
}
async function login(email = "test@example.com") {
  return cases.loginUser.execute({ email, password: secret });
}
async function identity(email = "test@example.com"): Promise<AccessClaims> {
  const u = await d.users.findByEmail(email);
  return { userId: u!.userId, role: u!.role, authVersion: u!.authVersion };
}

describe("PostgreSQL real, migraciones, seguridad y repositorios", () => {
  it("repite migración y conserva seis tablas sin metadata de Catálogo", async () => {
    await migrateDatabase(database.pool);
    const tables = await database.pool.query(
      "select tablename from pg_tables where schemaname='public'",
    );
    expect(tables.rows).toHaveLength(6);
    const columns = await database.pool.query(
      "select column_name from information_schema.columns where table_name in ('watchlist_items','content_preferences')",
    );
    expect(columns.rows.map((r) => r.column_name)).not.toEqual(
      expect.arrayContaining(["title", "poster", "synopsis", "genres"]),
    );
  });
  it("registro crea usuario y perfil, con hash y rol USER", async () => {
    const result = await register(" TEST@example.com ");
    const state = (await d.users.findByEmail("test@example.com"))!;
    expect(result.user.role).toBe("USER");
    expect(state.passwordHash).toMatch(/^\$argon2id/);
    expect(await d.passwords.verify(secret, state.passwordHash)).toBe(true);
    expect(result.user).not.toHaveProperty("passwordHash");
    expect(state).not.toHaveProperty("id");
    expect((await database.pool.query("select count(*)::int as n from profiles")).rows[0].n).toBe(
      1,
    );
  });
  it("hace rollback de usuario si falla la inserción del perfil", async () => {
    const state = user();
    await expect(
      d.users.create({ ...state, profile: { ...state.profile, displayName: "" } }),
    ).rejects.toThrow();
    expect((await database.pool.query("select count(*)::int as n from users")).rows[0].n).toBe(0);
  });
  it("impide emails duplicados incluso con registros concurrentes", async () => {
    const results = await Promise.allSettled([register(), register("TEST@EXAMPLE.COM")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.code).toBe("EMAIL_ALREADY_EXISTS");
  });
  it("login devuelve JWT y guarda solo hash de refresh", async () => {
    await register();
    const result = await login();
    expect((await d.access.verify(result.accessToken)).userId).toBe(result.user.userId);
    const rows = await database.pool.query("select token_hash from refresh_tokens");
    expect(rows.rows[0].token_hash).toBe(d.refresh.hash(result.refreshToken));
    expect(JSON.stringify(rows.rows)).not.toContain(result.refreshToken);
  });
  it("login incorrecto, ausente o inactivo devuelve el mismo error", async () => {
    await register();
    for (const [email, password] of [
      ["test@example.com", "wrong"],
      ["none@example.com", secret],
      ["x'or'1'='1@example.com", secret],
    ]) {
      await expect(
        cases.loginUser.execute({ email: email!, password: password! }),
      ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    }
    await database.pool.query("update users set status='INACTIVE'");
    await expect(login()).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
  it("rota sin prolongar caducidad absoluta y revoca familia al reutilizar", async () => {
    await register();
    const first = await login();
    const next = await cases.refreshSession.execute(first.refreshToken);
    expect(next.refreshToken).not.toBe(first.refreshToken);
    expect(next.refreshExpiresAt).toEqual(first.refreshExpiresAt);
    await expect(cases.refreshSession.execute(first.refreshToken)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(cases.refreshSession.execute(next.refreshToken)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(
      (
        await database.pool.query(
          "select count(*)::int as n from refresh_tokens where revoked_at is not null",
        )
      ).rows[0].n,
    ).toBe(2);
  });
  it("dos refresh simultáneos no dejan una familia utilizable tras detectar replay", async () => {
    await register();
    const first = await login();
    const results = await Promise.allSettled([
      cases.refreshSession.execute(first.refreshToken),
      cases.refreshSession.execute(first.refreshToken),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const success = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<
      Awaited<ReturnType<typeof login>>
    >;
    await expect(cases.refreshSession.execute(success.value.refreshToken)).rejects.toThrow();
  });
  it("logout con token anterior revoca también la rotación reciente", async () => {
    await register();
    const first = await login();
    const next = await cases.refreshSession.execute(first.refreshToken);
    await cases.logoutUser.execute(first.refreshToken);
    await cases.logoutUser.execute(first.refreshToken);
    await expect(cases.refreshSession.execute(next.refreshToken)).rejects.toThrow();
  });
  it("rechaza refresh vencido", async () => {
    await register();
    const first = await login();
    await database.pool.query(
      "update refresh_tokens set created_at=now()-interval '2 days', expires_at=now()-interval '1 day'",
    );
    await expect(cases.refreshSession.execute(first.refreshToken)).rejects.toThrow();
  });
  it("actualiza perfil parcialmente y limpia avatar sin cambiar email/rol", async () => {
    await register();
    const claims = await identity();
    const first = await cases.updateProfile.execute(claims, {
      avatarUrl: "https://example.com/a.png",
      preferredLanguage: "en",
    });
    const second = await cases.updateProfile.execute(claims, {
      displayName: "Nuevo",
      avatarUrl: null,
    });
    expect(second.profile).toEqual({
      displayName: "Nuevo",
      avatarUrl: null,
      preferredLanguage: "en",
    });
    expect(second.email).toBe(first.email);
    expect(second.role).toBe("USER");
  });
  it("cambio de password revoca sesiones y versión JWT local", async () => {
    await register();
    const first = await login();
    const claims = await d.access.verify(first.accessToken);
    await expect(
      cases.changePassword.execute(claims, {
        currentPassword: "wrong",
        newPassword: "NewPassword123!",
      }),
    ).rejects.toThrow();
    await cases.changePassword.execute(claims, {
      currentPassword: secret,
      newPassword: "NewPassword123!",
    });
    await expect(cases.getCurrentUser.execute(claims)).rejects.toThrow();
    await expect(cases.refreshSession.execute(first.refreshToken)).rejects.toThrow();
    await expect(login()).rejects.toThrow();
    expect(
      (await cases.loginUser.execute({ email: "test@example.com", password: "NewPassword123!" }))
        .user.userId,
    ).toBe(first.user.userId);
  });
  it("creación de sesión rechaza credenciales obsoletas tras cambio de password", async () => {
    await register();
    const u = (await d.users.findByEmail("test@example.com"))!;
    await d.users.changePassword(
      u.userId,
      u.passwordHash,
      await d.passwords.hash("NewPassword123!"),
      new Date(),
    );
    expect(
      await d.sessions.create(
        {
          id: randomUUID(),
          familyId: randomUUID(),
          userId: u.userId,
          tokenHash: d.refresh.issue().hash,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60000),
        },
        u.passwordHash,
      ),
    ).toBe(false);
  });
  it("Mi Lista impide duplicados, pagina, elimina y aísla usuarios", async () => {
    await register();
    await register("other@example.com");
    const a = await identity();
    const b = await identity("other@example.com");
    const id = `ttl_${randomUUID()}`;
    await cases.addToWatchlist.execute(a, id);
    await expect(cases.addToWatchlist.execute(a, id)).rejects.toMatchObject({
      code: "WATCHLIST_ITEM_ALREADY_EXISTS",
    });
    expect((await cases.getWatchlist.execute(b)).items).toHaveLength(0);
    await cases.removeFromWatchlist.execute(b, id);
    expect((await cases.getWatchlist.execute(a)).items).toHaveLength(1);
    await cases.removeFromWatchlist.execute(a, id);
    await cases.removeFromWatchlist.execute(a, id);
    expect((await cases.getWatchlist.execute(a)).items).toHaveLength(0);
  });
  it("LIKE→DISLIKE conserva createdAt y PUT idéntico no modifica updatedAt", async () => {
    await register();
    const a = await identity();
    const id = `ttl_${randomUUID()}`;
    const first = await cases.setContentPreference.execute(a, id, "LIKE");
    const again = await cases.setContentPreference.execute(a, id, "LIKE");
    expect(again).toEqual(first);
    const changed = await cases.setContentPreference.execute(a, id, "DISLIKE");
    expect(changed.createdAt).toEqual(first.createdAt);
    expect(changed.value).toBe("DISLIKE");
    expect((await cases.getContentPreferences.execute(a)).items).toHaveLength(1);
    await cases.removeContentPreference.execute(a, id);
    expect((await cases.getContentPreferences.execute(a)).items).toHaveLength(0);
  });
  it("rate limit comparte contador atómico entre instancias", async () => {
    const a = new PostgresRateLimiter(database.db);
    const b = new PostgresRateLimiter(database.db);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        (i % 2 ? a : b).consume("test", "email@example.com", 3, 60),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(
      (results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason.status,
    ).toBe(429);
  });
  it("revoca únicamente la familia del logout y conserva otra sesión independiente", async () => {
    await register();
    const a = await login(),
      b = await login();
    await cases.logoutUser.execute(a.refreshToken);
    await expect(cases.refreshSession.execute(a.refreshToken)).rejects.toThrow();
    expect((await cases.refreshSession.execute(b.refreshToken)).user.userId).toBe(a.user.userId);
  });
  it("aísla LIKE/DISLIKE y su eliminación por usuario incluso para el mismo tituloId", async () => {
    await register();
    await register("other@example.com");
    const a = await identity(),
      b = await identity("other@example.com"),
      id = `ttl_${randomUUID()}`;
    await cases.setContentPreference.execute(a, id, "LIKE");
    await cases.setContentPreference.execute(b, id, "DISLIKE");
    await cases.removeContentPreference.execute(a, id);
    await cases.removeContentPreference.execute(a, id);
    expect((await cases.getContentPreferences.execute(a)).items).toEqual([]);
    expect((await cases.getContentPreferences.execute(b)).items.map((p) => p.value)).toEqual([
      "DISLIKE",
    ]);
  });
  it("mantiene UNIQUE de Mi Lista bajo inserciones simultáneas", async () => {
    await register();
    const a = await identity(),
      id = `ttl_${randomUUID()}`;
    const results = await Promise.allSettled([
      cases.addToWatchlist.execute(a, id),
      cases.addToWatchlist.execute(a, id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await cases.getWatchlist.execute(a)).pagination.total).toBe(1);
  });
  it("expira ventanas de cuotas sin permitir que contadores previos bloqueen permanentemente", async () => {
    const limiter = new PostgresRateLimiter(database.db);
    await limiter.consume("expiry-test", "identity", 1, 60);
    await expect(limiter.consume("expiry-test", "identity", 1, 60)).rejects.toThrow();
    await database.pool.query("update rate_limit_buckets set expires_at=now()-interval '1 second'");
    await expect(limiter.consume("expiry-test", "identity", 1, 60)).resolves.toBeUndefined();
  });
});
