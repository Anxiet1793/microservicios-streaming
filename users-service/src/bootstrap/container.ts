import { randomUUID } from "node:crypto";
import { readConfig } from "../shared/config";
import { createDatabase } from "../modules/users/infrastructure/persistence/connection";
import { PostgresUserRepository } from "../modules/users/infrastructure/persistence/user-repository";
import { PostgresRefreshTokenRepository } from "../modules/users/infrastructure/persistence/refresh-token-repository";
import { PostgresWatchlistRepository } from "../modules/users/infrastructure/persistence/watchlist-repository";
import { PostgresContentPreferenceRepository } from "../modules/users/infrastructure/persistence/preference-repository";
import { Argon2Passwords } from "../modules/users/infrastructure/security/passwords";
import { OpaqueRefreshTokens, RsaAccessTokens } from "../modules/users/infrastructure/security/tokens";
import { PostgresRateLimiter } from "../modules/users/infrastructure/security/rate-limit";
import type { Dependencies } from "../modules/users/application/ports";
import { RegisterUser } from "../modules/users/application/use-cases/register-user";
import { LoginUser } from "../modules/users/application/use-cases/login-user";
import { RefreshSession } from "../modules/users/application/use-cases/refresh-session";
import { LogoutUser } from "../modules/users/application/use-cases/logout-user";
import { GetCurrentUser } from "../modules/users/application/use-cases/get-current-user";
import { UpdateProfile } from "../modules/users/application/use-cases/update-profile";
import { ChangePassword } from "../modules/users/application/use-cases/change-password";
import { AddToWatchlist } from "../modules/users/application/use-cases/add-to-watchlist";
import { RemoveFromWatchlist } from "../modules/users/application/use-cases/remove-from-watchlist";
import { GetWatchlist } from "../modules/users/application/use-cases/get-watchlist";
import { SetContentPreference } from "../modules/users/application/use-cases/set-content-preference";
import { RemoveContentPreference } from "../modules/users/application/use-cases/remove-content-preference";
import { GetContentPreferences } from "../modules/users/application/use-cases/get-content-preferences";
export function compose(d: Dependencies) { return {
registerUser: new RegisterUser(d),
loginUser: new LoginUser(d),
refreshSession: new RefreshSession(d),
logoutUser: new LogoutUser(d),
getCurrentUser: new GetCurrentUser(d),
updateProfile: new UpdateProfile(d),
changePassword: new ChangePassword(d),
addToWatchlist: new AddToWatchlist(d),
removeFromWatchlist: new RemoveFromWatchlist(d),
getWatchlist: new GetWatchlist(d),
setContentPreference: new SetContentPreference(d),
removeContentPreference: new RemoveContentPreference(d),
getContentPreferences: new GetContentPreferences(d),
}; }
export function createContainer() {
  const config = readConfig();
  const { db, pool } = createDatabase(config.DATABASE_URL);
  const access = new RsaAccessTokens(config);
  const d: Dependencies = {
    users: new PostgresUserRepository(db), sessions: new PostgresRefreshTokenRepository(db),
    watchlist: new PostgresWatchlistRepository(db), preferences: new PostgresContentPreferenceRepository(db),
    passwords: new Argon2Passwords(), access, refresh: new OpaqueRefreshTokens(), now: () => new Date(), uuid: randomUUID,
    accessTtl: config.ACCESS_TOKEN_TTL, refreshTtl: config.REFRESH_TOKEN_TTL,
  };
  return { config, pool, db, access, cases: compose(d), limiter: new PostgresRateLimiter(db) };
}
const shared = globalThis as typeof globalThis & { usersContainer?: ReturnType<typeof createContainer> };
export function container() { return shared.usersContainer ??= createContainer(); }
