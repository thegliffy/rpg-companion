import { useEffect, useState } from "react";
import type { Character, CampaignRole, Dnd5eSheetData } from "shared";
import { characterIsActive } from "shared";
import * as shopsApi from "../api/shops";
import * as charactersApi from "../api/characters";

export function ShopSection({
  campaignId,
  currentUserId,
  role,
}: {
  campaignId: number;
  currentUserId: number;
  role: CampaignRole;
}) {
  const [shop, setShop] = useState<Awaited<ReturnType<typeof shopsApi.getShop>> | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ name: "", basePrice: "0", quantity: "1" });

  function refresh() {
    shopsApi.getShop(campaignId).then(setShop).catch((err) => setError(err.message));
    charactersApi
      .listCampaignCharacters(campaignId)
      .then((all) => setCharacters(all.filter((c) => c.system === "dnd5e" && characterIsActive(c))))
      .catch(() => setCharacters([]));
  }

  useEffect(refresh, [campaignId]);

  const eligibleCharacters = role === "dm" ? characters : characters.filter((c) => c.ownerUserId === currentUserId);
  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId) ?? null;
  const selectedSheet = selectedCharacter ? (selectedCharacter.sheetData as Dnd5eSheetData) : null;

  async function guard(action: () => Promise<unknown>) {
    setError(null);
    setMessage(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function handleBuy(shopItemId: number) {
    if (selectedCharacterId === "") return;
    guard(async () => {
      await shopsApi.buyShopItem(campaignId, selectedCharacterId, shopItemId);
      setMessage("Purchased.");
    });
  }

  async function handleSell(itemId: string) {
    if (selectedCharacterId === "") return;
    guard(async () => {
      await shopsApi.sellShopItem(campaignId, selectedCharacterId, itemId);
      setMessage("Sold.");
    });
  }

  if (!shop) return null;

  return (
    <div>
      <h2>Shop</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {role === "dm" && (
        <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem" }}>
          <h3>Manage shop</h3>
          <label>
            <input
              type="checkbox"
              checked={shop.isOpen}
              onChange={(e) => guard(() => shopsApi.updateShop(campaignId, { isOpen: e.target.checked }))}
            />{" "}
            Shop open to players
          </label>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
            <label>
              Buy rate %{" "}
              <input
                type="number"
                min={0}
                defaultValue={shop.buyRatePercent}
                style={{ width: "4rem" }}
                onBlur={(e) => guard(() => shopsApi.updateShop(campaignId, { buyRatePercent: Number(e.target.value) || 0 }))}
              />
            </label>
            <label>
              Sell rate %{" "}
              <input
                type="number"
                min={0}
                defaultValue={shop.sellRatePercent}
                style={{ width: "4rem" }}
                onBlur={(e) => guard(() => shopsApi.updateShop(campaignId, { sellRatePercent: Number(e.target.value) || 0 }))}
              />
            </label>
          </div>

          <h4>Catalog</h4>
          {shop.items.map((item) => (
            <div key={item.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.3rem" }}>
              <span style={{ flex: 1 }}>{item.name}</span>
              <label>
                Price (gp){" "}
                <input
                  type="number"
                  min={0}
                  defaultValue={item.basePrice}
                  style={{ width: "4.5rem" }}
                  onBlur={(e) =>
                    guard(() => shopsApi.updateShopItem(campaignId, item.id, { basePrice: Number(e.target.value) || 0 }))
                  }
                />
              </label>
              <label>
                Stock{" "}
                <input
                  type="number"
                  min={0}
                  defaultValue={item.quantity}
                  style={{ width: "4rem" }}
                  onBlur={(e) =>
                    guard(() => shopsApi.updateShopItem(campaignId, item.id, { quantity: Number(e.target.value) || 0 }))
                  }
                />
              </label>
              <button type="button" onClick={() => guard(() => shopsApi.deleteShopItem(campaignId, item.id))}>
                Remove
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              placeholder="New item name"
              value={newItem.name}
              onChange={(e) => setNewItem((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="number"
              placeholder="Price (gp)"
              value={newItem.basePrice}
              onChange={(e) => setNewItem((prev) => ({ ...prev, basePrice: e.target.value }))}
              style={{ width: "6rem" }}
            />
            <input
              type="number"
              placeholder="Stock"
              value={newItem.quantity}
              onChange={(e) => setNewItem((prev) => ({ ...prev, quantity: e.target.value }))}
              style={{ width: "5rem" }}
            />
            <button
              type="button"
              disabled={!newItem.name.trim()}
              onClick={() =>
                guard(async () => {
                  await shopsApi.addShopItem(campaignId, {
                    name: newItem.name.trim(),
                    basePrice: Number(newItem.basePrice) || 0,
                    quantity: Number(newItem.quantity) || 0,
                  });
                  setNewItem({ name: "", basePrice: "0", quantity: "1" });
                })
              }
            >
              Add item
            </button>
          </div>
        </div>
      )}

      {!shop.isOpen ? (
        <p>The shop is currently closed.</p>
      ) : eligibleCharacters.length === 0 ? (
        <p>No eligible character in this campaign to shop with.</p>
      ) : (
        <div>
          <label>
            Shopping as{" "}
            <select
              value={selectedCharacterId}
              onChange={(e) => setSelectedCharacterId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Choose a character…</option>
              {eligibleCharacters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {selectedSheet && (
            <p>
              Currency: {selectedSheet.currency.pp}pp {selectedSheet.currency.gp}gp {selectedSheet.currency.ep}ep{" "}
              {selectedSheet.currency.sp}sp {selectedSheet.currency.cp}cp
            </p>
          )}

          <h3>For sale</h3>
          {shop.items.filter((i) => i.quantity > 0).length === 0 && <p>Nothing in stock.</p>}
          {shop.items
            .filter((i) => i.quantity > 0)
            .map((item) => (
              <div key={item.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.3rem" }}>
                <span style={{ flex: 1 }}>
                  {item.name} ({item.quantity} in stock)
                </span>
                <span>{Math.ceil((item.basePrice * shop.buyRatePercent) / 100)} gp</span>
                <button type="button" disabled={selectedCharacterId === ""} onClick={() => handleBuy(item.id)}>
                  Buy
                </button>
              </div>
            ))}

          {selectedSheet && selectedSheet.items.length > 0 && (
            <>
              <h3>Sell from inventory</h3>
              {selectedSheet.items.map((item) => (
                <div key={item.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.3rem" }}>
                  <span style={{ flex: 1 }}>
                    {item.name} (x{item.quantity})
                  </span>
                  <span>{Math.ceil((item.value * shop.sellRatePercent) / 100)} gp each</span>
                  <button type="button" onClick={() => handleSell(item.id)}>
                    Sell one
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
