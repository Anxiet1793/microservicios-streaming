import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database } from "../persistence/connection";
import { UsersError } from "../../domain/errors";
export class RateLimitError extends UsersError {
  constructor(readonly retryAfter: number) {
    super("RATE_LIMIT_EXCEEDED", 429, "Demasiados intentos. Intente más tarde.");
  }
}
/** Contador atómico compartido por todas las instancias. No confía en X-Forwarded-For. */
export class PostgresRateLimiter {
  constructor(private readonly db: Database) {}
  async consume(
    scope: string,
    identity: string,
    limit: number,
    windowSeconds: number,
  ): Promise<void> {
    const key = `${scope}:${createHash("sha256").update(identity).digest("hex")}`;
    const result = await this.db.execute<{ hits: number; retry_after: number }>(sql`
      insert into rate_limit_buckets (key, hits, expires_at)
      values (${key}, 1, now() + ${windowSeconds} * interval '1 second')
      on conflict (key) do update set
        hits = case when rate_limit_buckets.expires_at <= now() then 1 else least(rate_limit_buckets.hits + 1, ${limit + 1}) end,
        expires_at = case when rate_limit_buckets.expires_at <= now() then now() + ${windowSeconds} * interval '1 second' else rate_limit_buckets.expires_at end
      returning hits, greatest(1, ceil(extract(epoch from (expires_at - now()))))::int as retry_after`);
    if (result.rows[0]!.hits > limit) throw new RateLimitError(result.rows[0]!.retry_after);
  }
}
