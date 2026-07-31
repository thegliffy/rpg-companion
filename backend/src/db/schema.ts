import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Global account rank, separate from the per-campaign dm/player role above.
  role: text("role", { enum: ["player", "dm", "admin"] }).notNull().default("player"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const sessions = sqliteTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

// Long-lived bearer tokens for scripted API access (#146) -- separate from `sessions` above, which
// is browser-only and expires on a rolling 7-day window. A token authenticates as its owner and
// inherits their role, so it can do anything they can (the one exception is the token routes
// themselves -- see tokens.routes.ts).
export const apiTokens = sqliteTable("api_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  // What the token is for ("content upload script") -- the only way to tell two apart in the list,
  // since the token itself is never retrievable after creation.
  name: text("name").notNull(),
  // SHA-256 of the full token, hex. Deliberately *not* bcrypt: the token is 256 bits of CSPRNG
  // output so there is nothing to brute-force, and bcrypt's per-row salt would make lookup a full
  // table scan instead of the single indexed read a deterministic hash allows.
  tokenHash: text("token_hash").notNull().unique(),
  // First few chars of the plaintext ("rpgc_A1b2C3d4"), shown in the list so a token is
  // identifiable without storing anything that could be used to authenticate.
  prefix: text("prefix").notNull(),
  // Written best-effort on each use so a stale or suspicious token is visible before it's a problem.
  lastUsedAt: text("last_used_at"),
  // Null means no expiry.
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  ownerUserId: integer("owner_user_id")
    .notNull()
    .references(() => users.id),
  inviteCode: text("invite_code").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const campaignMemberships = sqliteTable(
  "campaign_memberships",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role", { enum: ["dm", "player"] }).notNull(),
    joinedAt: text("joined_at").notNull().default(sql`(current_timestamp)`),
  },
  (table) => [uniqueIndex("campaign_user_unique").on(table.campaignId, table.userId)],
);

export const characters = sqliteTable("characters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  ownerUserId: integer("owner_user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  system: text("system").notNull().default("generic"),
  portraitFilename: text("portrait_filename"),
  hpCurrent: integer("hp_current"),
  hpMax: integer("hp_max"),
  notes: text("notes"),
  sheetData: text("sheet_data").notNull().default("[]"),
  // Nullable, unique -- null means "not shared". A URL-safe random token that grants an
  // anonymous, read-only, redacted view of this one character (see the public shared-characters
  // router). It's a lookup key, never an auth credential -- it carries zero write capability.
  shareToken: text("share_token").unique(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

export const encounters = sqliteTable("encounters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  ownerUserId: integer("owner_user_id").references(() => users.id),
  name: text("name").notNull().default("Encounter"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  round: integer("round").notNull().default(1),
  currentTurnIndex: integer("current_turn_index").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

export const combatants = sqliteTable("combatants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  encounterId: integer("encounter_id")
    .notNull()
    .references(() => encounters.id),
  characterId: integer("character_id"),
  name: text("name").notNull(),
  initiative: integer("initiative").notNull(),
  hpCurrent: integer("hp_current"),
  hpMax: integer("hp_max"),
  conditions: text("conditions").notNull().default("[]"),
  sortOrder: integer("sort_order").notNull(),
});

export const diceRolls = sqliteTable("dice_rolls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  formula: text("formula").notNull(),
  label: text("label"),
  total: integer("total").notNull(),
  breakdown: text("breakdown").notNull(),
  // Structured per-die roll data (#136), JSON-encoded RollDetail -- null for rolls made before
  // this column existed, or anything buildRollDetail() couldn't confidently structure.
  detail: text("detail"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  campaignId: integer("campaign_id").references(() => campaigns.id),
  authorUserId: integer("author_user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  contentMd: text("content_md").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});

export const shops = sqliteTable(
  "shops",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    isOpen: integer("is_open", { mode: "boolean" }).notNull().default(false),
    buyRatePercent: integer("buy_rate_percent").notNull().default(100),
    sellRatePercent: integer("sell_rate_percent").notNull().default(50),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
    updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  },
  (table) => [uniqueIndex("shop_campaign_unique").on(table.campaignId)],
);

export const shopItems = sqliteTable("shop_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shopId: integer("shop_id")
    .notNull()
    .references(() => shops.id),
  name: text("name").notNull(),
  basePrice: integer("base_price").notNull().default(0),
  quantity: integer("quantity").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});

export const customContent = sqliteTable("custom_content", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["race", "class", "background", "subrace", "subclass", "feat", "spell", "item", "monster"] }).notNull(),
  // Which game system this content belongs to -- existing rows (pre-dating this column) are
  // all 5e, hence the default. Determines which sheet pickers/manager forms show the item.
  system: text("system", { enum: ["generic", "dnd5e", "pf2e"] }).notNull().default("dnd5e"),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  data: text("data").notNull(),
  status: text("status", { enum: ["pending", "approved"] }).notNull().default("pending"),
  approvedByUserId: integer("approved_by_user_id").references(() => users.id),
  approvedAt: text("approved_at"),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
});
