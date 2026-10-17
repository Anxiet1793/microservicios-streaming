import { and, asc, count, desc, eq } from "drizzle-orm";
import type { Pagination, WatchlistRepository } from "../../domain/repositories";
import { UsersError } from "../../domain/errors";
import type { Database } from "./connection";
import { watchlistItems } from "./schema";
import { internalUserId, isUnique } from "./user-repository";
export class PostgresWatchlistRepository implements WatchlistRepository {
  constructor(private readonly db: Database) {}
  async add(userId: string, tituloId: string, now: Date) {
    const id = await internalUserId(this.db, userId);
    try { await this.db.insert(watchlistItems).values({ userId: id, tituloId, createdAt: now }); }
    catch (error) { if (isUnique(error, "watchlist_items_user_id_title_id_pk")) throw new UsersError("WATCHLIST_ITEM_ALREADY_EXISTS", 409, "El título ya está en Mi lista."); throw error; }
    return { tituloId, addedAt: now };
  }
  async remove(userId: string, tituloId: string) {
    const id = await internalUserId(this.db, userId);
    await this.db.delete(watchlistItems).where(and(eq(watchlistItems.userId, id), eq(watchlistItems.tituloId, tituloId)));
  }
  async list(userId: string, pagination: Pagination) {
    const id = await internalUserId(this.db, userId);
    const where = eq(watchlistItems.userId, id);
    const [items, totals] = await Promise.all([
      this.db.select({ tituloId: watchlistItems.tituloId, addedAt: watchlistItems.createdAt }).from(watchlistItems).where(where).orderBy(desc(watchlistItems.createdAt), asc(watchlistItems.tituloId)).limit(pagination.limit).offset((pagination.page - 1) * pagination.limit),
      this.db.select({ total: count() }).from(watchlistItems).where(where),
    ]);
    const total = totals[0]!.total;
    return { items, pagination: { ...pagination, total, totalPages: Math.ceil(total / pagination.limit) } };
  }
}
