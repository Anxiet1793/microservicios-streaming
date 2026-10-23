import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { compose } from "../../src/bootstrap/container";
import type { AccessClaims, Dependencies } from "../../src/modules/users/application/ports";
import { UsersError } from "../../src/modules/users/domain/errors";
import { now, secret, user } from "../helpers/fixtures";
function setup() {
  const state = user();
  const claims: AccessClaims = {
    userId: state.userId,
    role: state.role,
    authVersion: state.authVersion,
  };
  const d: Dependencies = {
    users: {
      create: vi.fn(async (u) => u),
      findByEmail: vi.fn(async () => state),
      findById: vi.fn(async () => state),
      updateProfile: vi.fn(async () => state),
      changePassword: vi.fn(async () => true),
    },
    sessions: {
      create: vi.fn(async () => true),
      rotate: vi.fn(async () => ({
        kind: "ok" as const,
        user: state,
        expiresAt: new Date(now.getTime() + 100000),
      })),
      revoke: vi.fn(async () => undefined),
    },
    watchlist: {
      add: vi.fn(async (_u, tituloId, date) => ({ tituloId, addedAt: date })),
      remove: vi.fn(async () => undefined),
      list: vi.fn(async () => ({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })),
    },
    preferences: {
      set: vi.fn(async (_u, tituloId, value, date) => ({
        tituloId,
        value,
        createdAt: date,
        updatedAt: date,
      })),
      remove: vi.fn(async () => undefined),
      list: vi.fn(async () => ({
        items: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      })),
    },
    passwords: { hash: vi.fn(async () => "argon2-hash"), verify: vi.fn(async () => true) },
    access: {
      sign: vi.fn(async () => "jwt"),
      verify: vi.fn(async () => claims),
      jwks: vi.fn(async () => ({ keys: [] })),
    },
    refresh: {
      issue: vi.fn(() => ({ raw: "opaque", hash: "digest" })),
      hash: vi.fn(() => "digest"),
    },
    now: () => now,
    uuid: randomUUID,
    accessTtl: 900,
    refreshTtl: 86400,
  };
  return { d, state, claims, cases: compose(d) };
}
describe("Casos de uso aislados", () => {
  let c: ReturnType<typeof setup>;
  beforeEach(() => {
    c = setup();
  });
  it("registro hashea contraseña y no retorna el hash", async () => {
    const result = await c.cases.registerUser.execute({
      email: "TEST@example.com",
      password: secret,
      displayName: "Test",
    });
    expect(c.d.passwords.hash).toHaveBeenCalledWith(secret);
    expect(result.user).toMatchObject({ email: "test@example.com", role: "USER" });
    expect(JSON.stringify(result)).not.toContain("hash");
  });
  it("propaga email duplicado sin generar otra sesión", async () => {
    vi.mocked(c.d.users.create).mockRejectedValue(
      new UsersError("EMAIL_ALREADY_EXISTS", 409, "Duplicado"),
    );
    await expect(
      c.cases.registerUser.execute({
        email: "test@example.com",
        password: secret,
        displayName: "Test",
      }),
    ).rejects.toMatchObject({ code: "EMAIL_ALREADY_EXISTS" });
    expect(c.d.sessions.create).not.toHaveBeenCalled();
  });
  it("login guarda solo digest de refresh y retorna JWT", async () => {
    const result = await c.cases.loginUser.execute({ email: "test@example.com", password: secret });
    expect(result.accessToken).toBe("jwt");
    expect(result.expiresIn).toBe(900);
    expect(c.d.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: "digest", userId: c.state.userId }),
      c.state.passwordHash,
    );
  });
  it("login ausente ejecuta verificación dummy y devuelve error genérico", async () => {
    vi.mocked(c.d.users.findByEmail).mockResolvedValue(null);
    await expect(
      c.cases.loginUser.execute({ email: "missing@example.com", password: secret }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(c.d.passwords.verify).toHaveBeenCalledWith(secret, null);
    expect(c.d.sessions.create).not.toHaveBeenCalled();
  });
  it("rechaza contraseña incorrecta, usuario inactivo y carrera con cambio de password", async () => {
    vi.mocked(c.d.passwords.verify).mockResolvedValueOnce(false);
    await expect(
      c.cases.loginUser.execute({ email: c.state.email, password: secret }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    vi.mocked(c.d.users.findByEmail).mockResolvedValueOnce({ ...c.state, status: "INACTIVE" });
    await expect(
      c.cases.loginUser.execute({ email: c.state.email, password: secret }),
    ).rejects.toThrow();
    vi.mocked(c.d.sessions.create).mockResolvedValue(false);
    await expect(
      c.cases.loginUser.execute({ email: c.state.email, password: secret }),
    ).rejects.toThrow();
  });
  it("rota refresh y rechaza reutilización", async () => {
    expect((await c.cases.refreshSession.execute("opaque")).refreshToken).toBe("opaque");
    vi.mocked(c.d.sessions.rotate).mockResolvedValue({ kind: "reused" });
    await expect(c.cases.refreshSession.execute("opaque")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
  it("logout revoca por hash y es idempotente sin cookie", async () => {
    await c.cases.logoutUser.execute("opaque");
    await c.cases.logoutUser.execute();
    expect(c.d.sessions.revoke).toHaveBeenCalledExactlyOnceWith("digest", now);
  });
  it("actualiza perfil solo del usuario autenticado", async () => {
    const result = await c.cases.updateProfile.execute(c.claims, { displayName: "Nuevo" });
    expect(c.d.users.updateProfile).toHaveBeenCalledWith(
      c.state.userId,
      { displayName: "Nuevo" },
      now,
    );
    expect(result).not.toHaveProperty("passwordHash");
  });
  it("cambio de contraseña requiere la actual y compara hash esperado", async () => {
    await c.cases.changePassword.execute(c.claims, {
      currentPassword: secret,
      newPassword: "OtherPassword123!",
    });
    expect(c.d.users.changePassword).toHaveBeenCalledWith(
      c.state.userId,
      c.state.passwordHash,
      "argon2-hash",
      now,
    );
    vi.mocked(c.d.passwords.verify).mockResolvedValue(false);
    await expect(
      c.cases.changePassword.execute(c.claims, { currentPassword: "bad", newPassword: secret }),
    ).rejects.toThrow();
  });
  it("watchlist agrega, lista, elimina y propaga duplicados", async () => {
    const id = `ttl_${randomUUID()}`;
    await c.cases.addToWatchlist.execute(c.claims, id);
    await c.cases.getWatchlist.execute(c.claims);
    await c.cases.removeFromWatchlist.execute(c.claims, id);
    expect(c.d.watchlist.add).toHaveBeenCalledWith(c.state.userId, id, now);
    expect(c.d.watchlist.remove).toHaveBeenCalledWith(c.state.userId, id);
    vi.mocked(c.d.watchlist.add).mockRejectedValue(
      new UsersError("WATCHLIST_ITEM_ALREADY_EXISTS", 409, "Duplicado"),
    );
    await expect(c.cases.addToWatchlist.execute(c.claims, id)).rejects.toMatchObject({
      status: 409,
    });
  });
  it.each(["LIKE", "DISLIKE"] as const)(
    "almacena %s y admite eliminar preferencia",
    async (value) => {
      const id = `ttl_${randomUUID()}`;
      expect((await c.cases.setContentPreference.execute(c.claims, id, value)).value).toBe(value);
      await c.cases.getContentPreferences.execute(c.claims);
      await c.cases.removeContentPreference.execute(c.claims, id);
      expect(c.d.preferences.remove).toHaveBeenCalledWith(c.state.userId, id);
    },
  );
  it("rechaza versiones y roles falsos, usuarios inactivos y paginación excesiva", async () => {
    await expect(
      c.cases.getCurrentUser.execute({ ...c.claims, role: "ADMIN" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(c.cases.getWatchlist.execute({ ...c.claims, authVersion: 0 })).rejects.toThrow();
    vi.mocked(c.d.users.findById).mockResolvedValue({ ...c.state, status: "INACTIVE" });
    await expect(c.cases.getContentPreferences.execute(c.claims)).rejects.toThrow();
    await expect(c.cases.getWatchlist.execute(c.claims, 1, 101)).rejects.toThrow();
  });
});
