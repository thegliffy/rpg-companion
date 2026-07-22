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
