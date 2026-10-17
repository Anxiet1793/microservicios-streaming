import type { ContentPreferenceRepository, RefreshTokenRepository, UserRepository, WatchlistRepository } from "../domain/repositories";
import type { Role, UserState } from "../domain/user";
export interface PasswordHasher { hash(password: string): Promise<string>; verify(password: string, hash: string | null): Promise<boolean> }
export interface AccessClaims { userId: string; role: Role; authVersion: number }
export interface AccessTokens { sign(user: UserState): Promise<string>; verify(token: string): Promise<AccessClaims>; jwks(): Promise<{ keys: object[] }> }
export interface RefreshTokens { issue(): { raw: string; hash: string }; hash(raw: string): string }
export interface Dependencies {
  users: UserRepository; sessions: RefreshTokenRepository; watchlist: WatchlistRepository; preferences: ContentPreferenceRepository;
  passwords: PasswordHasher; access: AccessTokens; refresh: RefreshTokens;
  now(): Date; uuid(): string; accessTtl: number; refreshTtl: number;
}
