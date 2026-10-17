import { eq } from "drizzle-orm";
import type { RefreshTokenRepository, Rotation, SessionRecord } from "../../domain/repositories";
import type { Database } from "./connection";
import { refreshTokens, users } from "./schema";
import { getUser } from "./user-repository";

export class PostgresRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: Database) {}
  async create(session: SessionRecord, expectedPasswordHash: string): Promise<boolean> {
    return this.db.transaction(async tx => {
      const [user] = await tx.select().from(users).where(eq(users.userId, session.userId)).for("update");
      if (!user || user.status !== "ACTIVE" || user.passwordHash !== expectedPasswordHash) return false;
      await tx.insert(refreshTokens).values({ ...session, userId: user.id });
      return true;
    });
  }
  async rotate(tokenHash: string, next: { id: string; tokenHash: string }, now: Date): Promise<Rotation> {
    return this.db.transaction(async tx => {
      // Lookup inicial solo para conocer qué usuario bloquear. Se relee el token tras el lock.
      const [lookup] = await tx.select({ userId: refreshTokens.userId }).from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
      if (!lookup) return { kind: "invalid" };
      const [user] = await tx.select().from(users).where(eq(users.id, lookup.userId)).for("update");
      const [token] = await tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
      if (!user || !token || user.status !== "ACTIVE" || token.expiresAt <= now) return { kind: "invalid" };
      if (token.revokedAt || token.consumedAt) {
        await tx.update(refreshTokens).set({ revokedAt: now }).where(eq(refreshTokens.familyId, token.familyId));
        // Devolver en lugar de lanzar: la revocación debe COMMIT incluso al rechazar.
        return { kind: "reused" };
      }
      await tx.update(refreshTokens).set({ consumedAt: now }).where(eq(refreshTokens.id, token.id));
      await tx.insert(refreshTokens).values({ ...next, userId: user.id, familyId: token.familyId, createdAt: now, expiresAt: token.expiresAt });
      return { kind: "ok", user: (await getUser(tx, eq(users.id, user.id)))!, expiresAt: token.expiresAt };
    });
  }
  async revoke(tokenHash: string, now: Date): Promise<void> {
    await this.db.transaction(async tx => {
      const [token] = await tx.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
      if (!token) return;
      await tx.select({ id: users.id }).from(users).where(eq(users.id, token.userId)).for("update");
      // Revoca la familia incluso si logout recibió el token anterior a una rotación.
      await tx.update(refreshTokens).set({ revokedAt: now }).where(eq(refreshTokens.familyId, token.familyId));
    });
  }
}
