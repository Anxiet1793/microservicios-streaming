import { and, eq } from "drizzle-orm";
import type { UserRepository } from "../../domain/repositories";
import { Usuario, type Profile, type UserState } from "../../domain/user";
import { UsersError } from "../../domain/errors";
import { users, profiles, refreshTokens } from "./schema";
import type { Database, Executor } from "./connection";

export function isUnique(error: unknown, constraint: string): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; constraint?: string; cause?: unknown };
  return (
    (value.code === "23505" && value.constraint === constraint) ||
    (!!value.cause && isUnique(value.cause, constraint))
  );
}
export async function getUser(
  db: Executor,
  condition: ReturnType<typeof eq>,
): Promise<UserState | null> {
  const [row] = await db
    .select()
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(condition)
    .limit(1);
  if (!row) return null;
  const u = row.users;
  return Usuario.restore({
    userId: u.userId,
    email: u.email,
    passwordHash: u.passwordHash,
    role: u.role,
    status: u.status,
    authVersion: u.authVersion,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    profile: {
      displayName: row.profiles.displayName,
      avatarUrl: row.profiles.avatarUrl,
      preferredLanguage: row.profiles.preferredLanguage,
    },
  }).snapshot();
}
export async function internalUserId(db: Executor, userId: string): Promise<number> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.userId, userId));
  if (!row) throw new UsersError("USER_NOT_FOUND", 404, "Usuario no encontrado.");
  return row.id;
}
export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}
  findByEmail(email: string) {
    return getUser(this.db, eq(users.email, email));
  }
  findById(userId: string) {
    return getUser(this.db, eq(users.userId, userId));
  }
  async create(user: UserState): Promise<UserState> {
    try {
      await this.db.transaction(async (tx) => {
        const { profile, ...values } = user;
        const [inserted] = await tx.insert(users).values(values).returning({ id: users.id });
        await tx.insert(profiles).values({ userId: inserted!.id, ...profile });
      });
      return user;
    } catch (error) {
      if (isUnique(error, "users_email_uq"))
        throw new UsersError(
          "EMAIL_ALREADY_EXISTS",
          409,
          "Ya existe una cuenta asociada a ese correo.",
        );
      throw error;
    }
  }
  async updateProfile(userId: string, patch: Partial<Profile>, now: Date): Promise<UserState> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(users).where(eq(users.userId, userId)).for("update");
      if (!row || row.status !== "ACTIVE")
        throw new UsersError("UNAUTHORIZED", 401, "Usuario no disponible.");
      const existing = (await getUser(tx, eq(users.id, row.id)))!;
      const updated = Usuario.restore(existing).updateProfile(patch, now).snapshot();
      if (JSON.stringify(existing.profile) === JSON.stringify(updated.profile)) return existing;
      await tx.update(profiles).set(updated.profile).where(eq(profiles.userId, row.id));
      await tx.update(users).set({ updatedAt: now }).where(eq(users.id, row.id));
      return updated;
    });
  }
  async changePassword(
    userId: string,
    expectedHash: string,
    newHash: string,
    now: Date,
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.select().from(users).where(eq(users.userId, userId)).for("update");
      if (!row || row.status !== "ACTIVE" || row.passwordHash !== expectedHash) return false;
      await tx
        .update(users)
        .set({ passwordHash: newHash, authVersion: row.authVersion + 1, updatedAt: now })
        .where(and(eq(users.id, row.id), eq(users.passwordHash, expectedHash)));
      await tx
        .update(refreshTokens)
        .set({ revokedAt: now })
        .where(eq(refreshTokens.userId, row.id));
      return true;
    });
  }
}
