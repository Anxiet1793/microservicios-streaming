import { describe, expect, it } from "vitest";
import { normalizeEmail, Usuario, validatePassword, validateTitleId } from "../../src/modules/users/domain/user";
import { now, user } from "../helpers/fixtures";
describe("Usuario y value objects", () => {
  it("normaliza email y registra USER ACTIVE con identidad independiente", () => {
    expect(normalizeEmail(" Samuel@EXAMPLE.com ")).toBe("samuel@example.com");
    expect(user()).toMatchObject({ role: "USER", status: "ACTIVE", authVersion: 1 });
    expect(user().userId).toMatch(/^usr_/);
  });
  it.each(["", "bad", "a@", "a b@example.com"])("rechaza email inválido %s", value => { expect(() => normalizeEmail(value)).toThrow(); });
  it.each(["short", "a".repeat(129), "valid-long-password\0"])("rechaza contraseña inválida", value => { expect(() => validatePassword(value)).toThrow(); });
  it("no modifica contraseñas y admite frases largas", () => { const value = " una frase muy larga "; expect(validatePassword(value)).toBe(value); });
  it("aplica cambios parciales inmutables y permite quitar avatar", () => {
    const aggregate = Usuario.restore(user()); const updated = aggregate.updateProfile({ displayName: " Samuel ", avatarUrl: null }, now);
    expect(updated.snapshot().profile).toEqual({ displayName: "Samuel", avatarUrl: null, preferredLanguage: "es" });
    expect(aggregate.snapshot().profile.displayName).toBe("Test");
    updated.snapshot().createdAt.setFullYear(1900); expect(updated.snapshot().createdAt).toEqual(now);
  });
  it("rechaza campos protegidos, perfil vacío y URLs inseguras", () => {
    const aggregate = Usuario.restore(user());
    expect(() => aggregate.updateProfile({}, now)).toThrow();
    expect(() => aggregate.updateProfile({ role: "ADMIN" } as never, now)).toThrow();
    expect(() => aggregate.updateProfile({ avatarUrl: "javascript:alert(1)" }, now)).toThrow();
    expect(() => aggregate.updateProfile({ avatarUrl: "https://user:pass@example.com" }, now)).toThrow();
  });
  it("acepta exclusivamente el TituloId público de Catálogo", () => {
    expect(validateTitleId("ttl_00000000-0000-4000-8000-000000000001")).toMatch(/^ttl_/);
    expect(() => validateTitleId("507f1f77bcf86cd799439011")).toThrow();
  });
});
