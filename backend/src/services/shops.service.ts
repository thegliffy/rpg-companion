import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { shops, shopItems } from "../db/schema.js";
import type { Shop, ShopItem, Dnd5eSheetData } from "shared";
import { currencyToCopper, copperToCurrency } from "shared";
import { getCharacter, updateCharacter } from "./characters.service.js";

export class ShopClosedError extends Error {}
export class ShopItemNotFoundError extends Error {}
export class OutOfStockError extends Error {}
export class InsufficientFundsError extends Error {}
export class InventoryItemNotFoundError extends Error {}
export class CharacterNotEligibleError extends Error {}

function toShopItem(row: typeof shopItems.$inferSelect): ShopItem {
  return {
    id: row.id,
    shopId: row.shopId,
    name: row.name,
    basePrice: row.basePrice,
    quantity: row.quantity,
    createdAt: row.createdAt,
  };
}

function toShop(row: typeof shops.$inferSelect, items: ShopItem[]): Shop {
  return {
    id: row.id,
    campaignId: row.campaignId,
    isOpen: row.isOpen,
    buyRatePercent: row.buyRatePercent,
    sellRatePercent: row.sellRatePercent,
    items,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getOrCreateShopRow(campaignId: number) {
  const existing = db.select().from(shops).where(eq(shops.campaignId, campaignId)).get();
  if (existing) return existing;
  const [created] = await db.insert(shops).values({ campaignId }).returning();
  return created;
}

export async function getShop(campaignId: number): Promise<Shop> {
  const row = await getOrCreateShopRow(campaignId);
  const items = db.select().from(shopItems).where(eq(shopItems.shopId, row.id)).all().map(toShopItem);
  return toShop(row, items);
}

export async function updateShop(
  campaignId: number,
  updates: { isOpen?: boolean; buyRatePercent?: number; sellRatePercent?: number },
): Promise<Shop> {
  const row = await getOrCreateShopRow(campaignId);
  const dbUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (updates.isOpen !== undefined) dbUpdates.isOpen = updates.isOpen;
  if (updates.buyRatePercent !== undefined) dbUpdates.buyRatePercent = updates.buyRatePercent;
  if (updates.sellRatePercent !== undefined) dbUpdates.sellRatePercent = updates.sellRatePercent;
  await db.update(shops).set(dbUpdates).where(eq(shops.id, row.id));
  return getShop(campaignId);
}

export async function addShopItem(
  campaignId: number,
  input: { name: string; basePrice: number; quantity: number },
): Promise<Shop> {
  const row = await getOrCreateShopRow(campaignId);
  await db.insert(shopItems).values({ shopId: row.id, ...input });
  return getShop(campaignId);
}

export async function updateShopItem(
  campaignId: number,
  itemId: number,
  updates: { name?: string; basePrice?: number; quantity?: number },
): Promise<Shop> {
  await db.update(shopItems).set(updates).where(eq(shopItems.id, itemId));
  return getShop(campaignId);
}

export async function deleteShopItem(campaignId: number, itemId: number): Promise<Shop> {
  await db.delete(shopItems).where(eq(shopItems.id, itemId));
  return getShop(campaignId);
}

/** Buys one unit of a shop item for the given character, deducting currency and decrementing stock. */
export async function buyItem(campaignId: number, characterId: number, shopItemId: number) {
  const shopRow = await getOrCreateShopRow(campaignId);
  if (!shopRow.isOpen) throw new ShopClosedError("The shop is closed");

  const itemRow = db.select().from(shopItems).where(eq(shopItems.id, shopItemId)).get();
  if (!itemRow || itemRow.shopId !== shopRow.id) throw new ShopItemNotFoundError("Shop item not found");
  if (itemRow.quantity <= 0) throw new OutOfStockError("Out of stock");

  const character = getCharacter(characterId);
  if (!character || character.system !== "dnd5e" || character.campaignId !== campaignId) {
    throw new CharacterNotEligibleError("Character not eligible to use this shop");
  }
  const sheet = character.sheetData as Dnd5eSheetData;

  const costGp = Math.ceil((itemRow.basePrice * shopRow.buyRatePercent) / 100);
  const costCopper = costGp * 100;
  const currentCopper = currencyToCopper(sheet.currency);
  if (currentCopper < costCopper) throw new InsufficientFundsError("Not enough currency");

  const updatedSheet: Dnd5eSheetData = {
    ...sheet,
    currency: copperToCurrency(currentCopper - costCopper),
    items: [
      ...sheet.items,
      {
        id: `item-${Date.now()}`,
        name: itemRow.name,
        quantity: 1,
        weight: 0,
        notes: "",
        equipped: false,
        abilityBonuses: {},
        acBonus: 0,
        requiresAttunement: false,
        attuned: false,
        value: itemRow.basePrice,
      },
    ],
  };

  await updateCharacter(characterId, { sheetData: updatedSheet });
  await db.update(shopItems).set({ quantity: itemRow.quantity - 1 }).where(eq(shopItems.id, shopItemId));

  return { character: getCharacter(characterId)!, shop: await getShop(campaignId) };
}

/** Sells one unit of an inventory item back to the shop, paying out currency. */
export async function sellItem(campaignId: number, characterId: number, itemId: string) {
  const shopRow = await getOrCreateShopRow(campaignId);
  if (!shopRow.isOpen) throw new ShopClosedError("The shop is closed");

  const character = getCharacter(characterId);
  if (!character || character.system !== "dnd5e" || character.campaignId !== campaignId) {
    throw new CharacterNotEligibleError("Character not eligible to use this shop");
  }
  const sheet = character.sheetData as Dnd5eSheetData;
  const item = sheet.items.find((i) => i.id === itemId);
  if (!item) throw new InventoryItemNotFoundError("Inventory item not found");

  const payoutGp = Math.ceil((item.value * shopRow.sellRatePercent) / 100);
  const payoutCopper = payoutGp * 100;
  const currentCopper = currencyToCopper(sheet.currency);

  const items =
    item.quantity > 1
      ? sheet.items.map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
      : sheet.items.filter((i) => i.id !== itemId);

  const updatedSheet: Dnd5eSheetData = {
    ...sheet,
    currency: copperToCurrency(currentCopper + payoutCopper),
    items,
  };

  await updateCharacter(characterId, { sheetData: updatedSheet });

  return { character: getCharacter(characterId)!, shop: await getShop(campaignId) };
}
