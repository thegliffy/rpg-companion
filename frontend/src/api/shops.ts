import type { Shop, Character } from "shared";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

export async function getShop(campaignId: number): Promise<Shop> {
  const res = await fetch(`/api/campaigns/${campaignId}/shop`);
  const data = await parseOrThrow(res);
  return data.shop;
}

export async function updateShop(
  campaignId: number,
  updates: { isOpen?: boolean; buyRatePercent?: number; sellRatePercent?: number },
): Promise<Shop> {
  const res = await fetch(`/api/campaigns/${campaignId}/shop`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await parseOrThrow(res);
  return data.shop;
}

export async function addShopItem(
  campaignId: number,
  item: { name: string; basePrice: number; quantity: number },
): Promise<Shop> {
  const res = await fetch(`/api/campaigns/${campaignId}/shop/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  const data = await parseOrThrow(res);
  return data.shop;
}

export async function updateShopItem(
  campaignId: number,
  itemId: number,
  updates: { name?: string; basePrice?: number; quantity?: number },
): Promise<Shop> {
  const res = await fetch(`/api/campaigns/${campaignId}/shop/items/${itemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await parseOrThrow(res);
  return data.shop;
}

export async function deleteShopItem(campaignId: number, itemId: number): Promise<Shop> {
  const res = await fetch(`/api/campaigns/${campaignId}/shop/items/${itemId}`, { method: "DELETE" });
  const data = await parseOrThrow(res);
  return data.shop;
}

export async function buyShopItem(
  campaignId: number,
  characterId: number,
  shopItemId: number,
): Promise<{ character: Character; shop: Shop }> {
  const res = await fetch(`/api/campaigns/${campaignId}/shop/buy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId, shopItemId }),
  });
  return parseOrThrow(res);
}

export async function sellShopItem(
  campaignId: number,
  characterId: number,
  itemId: string,
): Promise<{ character: Character; shop: Shop }> {
  const res = await fetch(`/api/campaigns/${campaignId}/shop/sell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ characterId, itemId }),
  });
  return parseOrThrow(res);
}
