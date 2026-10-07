/** Drizzle schema — mirrors db/migrations/*.sql exactly.
 * The SQL migrations are the source of truth (flyway-style); this file only
 * gives Drizzle typed query builders, so keep the two in sync manually. */
import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const now = () => sql`datetime('now')`;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull().unique(),
  displayName: text("display_name"),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("active"),
  locale: text("locale").notNull().default("en"),
  onboardedAt: text("onboarded_at"),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull().default(now()),
  updatedAt: text("updated_at").notNull().default(now()),
});

export const otpCodes = sqliteTable(
  "otp_codes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    phone: text("phone").notNull(),
    code: text("code").notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull().default(now()),
  },
  (t) => [index("idx_otp_phone_created").on(t.phone, t.createdAt)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull().default(now()),
    lastSeenAt: text("last_seen_at").notNull().default(now()),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("idx_sessions_user").on(t.userId)],
);

export const backbones = sqliteTable(
  "backbones",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug"),
    name: text("name").notNull(),
    description: text("description"),
    source: text("source").notNull().default("custom"),
    foodOverspendCategoryId: integer("food_overspend_category_id"),
    isActive: integer("is_active").notNull().default(0),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
  },
  (t) => [
    uniqueIndex("uq_backbones_one_active")
      .on(t.userId)
      .where(sql`user_id IS NOT NULL AND is_active = 1`),
    uniqueIndex("uq_backbones_preset_slug")
      .on(t.slug)
      .where(sql`slug IS NOT NULL`),
    index("idx_backbones_user").on(t.userId),
  ],
);

export const backboneCategories = sqliteTable(
  "backbone_categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    backboneId: integer("backbone_id")
      .notNull()
      .references(() => backbones.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    percentBp: integer("percent_bp").notNull(),
    defaultForFood: integer("default_for_food").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(now()),
  },
  (t) => [index("idx_categories_backbone").on(t.backboneId)],
);

export const userSettings = sqliteTable("user_settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  monthlyIncome: integer("monthly_income").notNull().default(0),
  dailyFoodBudget: integer("daily_food_budget").notNull().default(0),
  currency: text("currency").notNull().default("IDR"),
  updatedAt: text("updated_at").notNull().default(now()),
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => backboneCategories.id),
    kind: text("kind").notNull().default("expense"),
    name: text("name").notNull(),
    amount: integer("amount").notNull(),
    isFood: integer("is_food").notNull().default(0),
    spentOn: text("spent_on").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull().default(now()),
    updatedAt: text("updated_at").notNull().default(now()),
  },
  (t) => [
    index("idx_tx_user_date").on(t.userId, t.spentOn),
    index("idx_tx_user_category").on(t.userId, t.categoryId),
    index("idx_tx_user_food").on(t.userId, t.isFood, t.spentOn),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorUserId: integer("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity"),
    entityId: text("entity_id"),
    metadata: text("metadata"),
    createdAt: text("created_at").notNull().default(now()),
  },
  (t) => [index("idx_audit_actor_created").on(t.actorUserId, t.createdAt)],
);

export const userActivity = sqliteTable(
  "user_activity",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityDate: text("activity_date").notNull(),
    events: integer("events").notNull().default(0),
    lastSeenAt: text("last_seen_at").notNull().default(now()),
  },
  (t) => [index("idx_activity_date").on(t.activityDate)],
);

export type User = typeof users.$inferSelect;
export type Backbone = typeof backbones.$inferSelect;
export type BackboneCategory = typeof backboneCategories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
