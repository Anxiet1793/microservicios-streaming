import { sql } from "drizzle-orm";
import { bigint, bigserial, check, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const userStatus = pgEnum("user_status", ["ACTIVE", "INACTIVE"]);
export const userRole = pgEnum("user_role", ["USER", "ADMIN"]);
export const preferenceValue = pgEnum("preference_value", ["LIKE", "DISLIKE"]);
const time = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
export const users = pgTable("users", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: varchar("user_id", { length: 40 }).notNull(), email: varchar("email", { length: 254 }).notNull(),
  passwordHash: text("password_hash").notNull(), status: userStatus("status").notNull().default("ACTIVE"), role: userRole("role").notNull().default("USER"),
  authVersion: integer("auth_version").notNull().default(1), createdAt: time("created_at").notNull().defaultNow(), updatedAt: time("updated_at").notNull().defaultNow(),
}, t => [uniqueIndex("users_user_id_uq").on(t.userId), uniqueIndex("users_email_uq").on(t.email),
  check("users_email_normalized", sql`${t.email} = lower(btrim(${t.email}))`),
  check("users_id_format", sql`${t.userId} ~ '^usr_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`),
  check("users_auth_version_positive", sql`${t.authVersion} > 0`), check("users_dates", sql`${t.updatedAt} >= ${t.createdAt}`)]);
export const profiles = pgTable("profiles", {
  userId: bigint("user_id", { mode: "number" }).primaryKey().references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 100 }).notNull(), avatarUrl: varchar("avatar_url", { length: 2048 }), preferredLanguage: varchar("preferred_language", { length: 5 }).notNull().default("es"),
}, t => [check("profile_display_name_nonempty", sql`length(btrim(${t.displayName})) > 0`), check("profile_language_format", sql`${t.preferredLanguage} ~ '^[a-z]{2}(-[A-Z]{2})?$'`)]);
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey(), userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  familyId: uuid("family_id").notNull(), tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: time("expires_at").notNull(), revokedAt: time("revoked_at"), consumedAt: time("consumed_at"), createdAt: time("created_at").notNull().defaultNow(),
}, t => [uniqueIndex("refresh_tokens_hash_uq").on(t.tokenHash), index("refresh_tokens_user_idx").on(t.userId), index("refresh_tokens_family_idx").on(t.familyId), index("refresh_tokens_expiry_idx").on(t.expiresAt),
  check("refresh_hash_format", sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`), check("refresh_dates", sql`${t.expiresAt} > ${t.createdAt}`)]);
export const watchlistItems = pgTable("watchlist_items", {
  userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  tituloId: varchar("title_id", { length: 40 }).notNull(), createdAt: time("created_at").notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.tituloId] }), index("watchlist_user_created_idx").on(t.userId, t.createdAt, t.tituloId),
  check("watchlist_title_format", sql`${t.tituloId} ~ '^ttl_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`)]);
export const contentPreferences = pgTable("content_preferences", {
  userId: bigint("user_id", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
  tituloId: varchar("title_id", { length: 40 }).notNull(), value: preferenceValue("value").notNull(),
  createdAt: time("created_at").notNull().defaultNow(), updatedAt: time("updated_at").notNull().defaultNow(),
}, t => [primaryKey({ columns: [t.userId, t.tituloId] }), index("preferences_user_updated_idx").on(t.userId, t.updatedAt, t.tituloId),
  check("preferences_title_format", sql`${t.tituloId} ~ '^ttl_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`), check("preferences_dates", sql`${t.updatedAt} >= ${t.createdAt}`)]);
/** Infraestructura compartida entre réplicas; no pertenece al agregado Usuario. */
export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: varchar("key", { length: 100 }).primaryKey(), hits: integer("hits").notNull(), expiresAt: time("expires_at").notNull(),
}, t => [index("rate_limit_expiry_idx").on(t.expiresAt), check("rate_limit_positive", sql`${t.hits} > 0`)]);
