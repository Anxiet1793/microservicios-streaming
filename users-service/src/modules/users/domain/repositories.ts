import type { PreferenceValue, Profile, UserState } from "./user";

export interface UserRepository {
  create(user: UserState): Promise<UserState>;
  findByEmail(email: string): Promise<UserState | null>;
  findById(userId: string): Promise<UserState | null>;
  updateProfile(userId: string, patch: Partial<Profile>, now: Date): Promise<UserState>;
  changePassword(
    userId: string,
    expectedHash: string,
    newHash: string,
    now: Date,
  ): Promise<boolean>;
}
export interface SessionRecord {
  id: string;
  familyId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}
export type Rotation =
  { kind: "ok"; user: UserState; expiresAt: Date } | { kind: "invalid" | "reused" };
export interface RefreshTokenRepository {
  create(session: SessionRecord, expectedPasswordHash: string): Promise<boolean>;
  rotate(tokenHash: string, next: { id: string; tokenHash: string }, now: Date): Promise<Rotation>;
  revoke(tokenHash: string, now: Date): Promise<void>;
}
export interface Pagination {
  page: number;
  limit: number;
}
export interface WatchlistItem {
  tituloId: string;
  addedAt: Date;
}
export interface ContentPreference {
  tituloId: string;
  value: PreferenceValue;
  createdAt: Date;
  updatedAt: Date;
}
export interface Page<T> {
  items: T[];
  pagination: Pagination & { total: number; totalPages: number };
}
export interface WatchlistRepository {
  add(userId: string, tituloId: string, now: Date): Promise<WatchlistItem>;
  remove(userId: string, tituloId: string): Promise<void>;
  list(userId: string, page: Pagination): Promise<Page<WatchlistItem>>;
}
export interface ContentPreferenceRepository {
  set(
    userId: string,
    tituloId: string,
    value: PreferenceValue,
    now: Date,
  ): Promise<ContentPreference>;
  remove(userId: string, tituloId: string): Promise<void>;
  list(userId: string, page: Pagination): Promise<Page<ContentPreference>>;
}
