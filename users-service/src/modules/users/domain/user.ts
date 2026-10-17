import { invalid } from "./errors";

export const USER_ID = /^usr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const TITLE_ID = /^ttl_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type Role = "USER" | "ADMIN";
export type Status = "ACTIVE" | "INACTIVE";
export type PreferenceValue = "LIKE" | "DISLIKE";
export interface Profile { displayName: string; avatarUrl: string | null; preferredLanguage: string }
export interface UserState { userId: string; email: string; passwordHash: string; status: Status; role: Role; profile: Profile; authVersion: number; createdAt: Date; updatedAt: Date }
export function normalizeEmail(value: string): string {
  if (typeof value !== "string") invalid();
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid("Email inválido.");
  return email;
}
export function validatePassword(value: string): string {
  if (typeof value !== "string" || [...value].length < 12 || [...value].length > 128 || value.includes("\0")) invalid("La contraseña debe contener entre 12 y 128 caracteres, sin caracteres nulos.");
  return value;
}
export function validateProfile(value: Profile): Profile {
  if (!value || typeof value.displayName !== "string" || !value.displayName.trim() || [...value.displayName.trim()].length > 100
    || typeof value.preferredLanguage !== "string" || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(value.preferredLanguage)) invalid("Perfil inválido.");
  if (value.avatarUrl !== null) {
    try { const url = new URL(value.avatarUrl); if (value.avatarUrl.length > 2048 || !["https:", "http:"].includes(url.protocol) || url.username || url.password) invalid(); }
    catch { invalid("URL de avatar inválida."); }
  }
  return Object.freeze({ ...value, displayName: value.displayName.trim() });
}
export function validateTitleId(value: string): string { if (typeof value !== "string" || !TITLE_ID.test(value)) invalid("TituloId inválido."); return value; }

/** Agregado inmutable. El perfil no tiene identidad ni ciclo de vida independiente. */
export class Usuario {
  private constructor(private readonly state: UserState) { Object.freeze(this); }
  static register(input: Pick<UserState, "userId" | "email" | "passwordHash" | "profile">, now: Date): Usuario {
    return Usuario.restore({ ...input, email: normalizeEmail(input.email), status: "ACTIVE", role: "USER", authVersion: 1, createdAt: now, updatedAt: now });
  }
  static restore(state: UserState): Usuario {
    if (!USER_ID.test(state.userId) || !state.passwordHash || !["ACTIVE", "INACTIVE"].includes(state.status)
      || !["USER", "ADMIN"].includes(state.role) || !Number.isSafeInteger(state.authVersion) || state.authVersion < 1
      || !Number.isFinite(state.createdAt.getTime()) || !Number.isFinite(state.updatedAt.getTime()) || state.updatedAt < state.createdAt) invalid("Estado de usuario inválido.");
    return new Usuario(Object.freeze({ ...state, email: normalizeEmail(state.email), profile: validateProfile(state.profile), createdAt: new Date(state.createdAt), updatedAt: new Date(state.updatedAt) }));
  }
  snapshot(): UserState { return { ...this.state, createdAt: new Date(this.state.createdAt), updatedAt: new Date(this.state.updatedAt) }; }
  updateProfile(patch: Partial<Profile>, now: Date): Usuario {
    if (!Object.keys(patch).length || Object.keys(patch).some(key => !["displayName", "avatarUrl", "preferredLanguage"].includes(key))) invalid();
    return Usuario.restore({ ...this.state, profile: validateProfile({ ...this.state.profile, ...patch }), updatedAt: now });
  }
}
