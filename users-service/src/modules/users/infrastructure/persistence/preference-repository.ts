import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import type { ContentPreferenceRepository, Pagination } from "../../domain/repositories";
import type { PreferenceValue } from "../../domain/user";
import type { Database } from "./connection";
import { contentPreferences as table } from "./schema";
import { internalUserId } from "./user-repository";
const projection = {
  tituloId: table.tituloId,
  value: table.value,
  createdAt: table.createdAt,
  updatedAt: table.updatedAt,
};
export class PostgresContentPreferenceRepository implements ContentPreferenceRepository {
  constructor(private readonly db: Database) {}
  async set(userId: string, tituloId: string, value: PreferenceValue, now: Date) {
    const id = await internalUserId(this.db, userId);
    const [row] = await this.db
      .insert(table)
      .values({ userId: id, tituloId, value, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [table.userId, table.tituloId],
        set: {
          value,
          updatedAt: sql`case when ${table.value} = ${value} then ${table.updatedAt} else ${now.toISOString()}::timestamptz end`,
        },
      })
      .returning(projection);
    return row!;
  }
  async remove(userId: string, tituloId: string) {
    const id = await internalUserId(this.db, userId);
    await this.db.delete(table).where(and(eq(table.userId, id), eq(table.tituloId, tituloId)));
  }
  async list(userId: string, pagination: Pagination) {
    const id = await internalUserId(this.db, userId);
    const where = eq(table.userId, id);
    const [items, totals] = await Promise.all([
      this.db
        .select(projection)
        .from(table)
        .where(where)
        .orderBy(desc(table.updatedAt), asc(table.tituloId))
        .limit(pagination.limit)
        .offset((pagination.page - 1) * pagination.limit),
      this.db.select({ total: count() }).from(table).where(where),
    ]);
    const total = totals[0]!.total;
    return {
      items,
      pagination: { ...pagination, total, totalPages: Math.ceil(total / pagination.limit) },
    };
  }
}
