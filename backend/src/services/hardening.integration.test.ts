import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import express from "express";
import type { Server } from "node:http";
import { emptyDnd5eSheet, type Dnd5eSheetData } from "shared";
import { setupTestDatabase } from "../test/harness.js";
import { createUser } from "./users.service.js";
import { createCampaign } from "./campaigns.service.js";
import {
  CharacterConflictError,
  createCharacter,
  getCharacter,
  mintShareToken,
  updateCharacter,
} from "./characters.service.js";
import {
  addShopItem,
  deleteShopItem,
  getShop,
  ShopItemNotFoundError,
  updateShopItem,
  buyItem,
  updateShop,
} from "./shops.service.js";
import {
  getActiveEncounterForCampaign,
  startEncounter,
  startPersonalEncounter,
  getActiveEncounterForOwner,
} from "./encounters.service.js";
import { charactersRouter } from "../routes/characters.routes.js";
import { sharedCharactersRouter } from "../routes/sharedCharacters.routes.js";
import { createSessionMiddleware } from "../middleware/session.js";
import { db } from "../db/client.js";
import { eq } from "drizzle-orm";
import { shopItems } from "../db/schema.js";

before(() => {
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-session-secret";
  setupTestDatabase();
});

describe("shop item campaign scoping (#82)", () => {
  it("refuses to update/delete an item belonging to another campaign's shop", async () => {
    const dmA = await createUser(`dm-a-${Date.now()}`, "password-a-1");
    const dmB = await createUser(`dm-b-${Date.now()}`, "password-b-1");
    const campA = await createCampaign(dmA.id, "Campaign A");
    const campB = await createCampaign(dmB.id, "Campaign B");

    await addShopItem(campB.id, { name: "Potion", basePrice: 50, quantity: 3 });
    const shopB = await getShop(campB.id);
    const itemB = shopB.items[0];
    assert.ok(itemB);

    await assert.rejects(
      () => updateShopItem(campA.id, itemB.id, { quantity: 99 }),
      ShopItemNotFoundError,
    );
    await assert.rejects(() => deleteShopItem(campA.id, itemB.id), ShopItemNotFoundError);

    const stillThere = db.select().from(shopItems).where(eq(shopItems.id, itemB.id)).get();
    assert.equal(stillThere?.quantity, 3);
  });
});

describe("first-registration admin race (#83)", () => {
  it("promotes only the first inserted user when count+insert are transactional", async () => {
    // Fresh DB already has users from prior tests in this file — use a dedicated DB for this case.
    setupTestDatabase();
    const [a, b] = await Promise.all([
      createUser(`first-${Date.now()}-a`, "password-a-12"),
      createUser(`first-${Date.now()}-b`, "password-b-12"),
    ]);
    const admins = [a, b].filter((u) => u.role === "admin");
    assert.equal(admins.length, 1);
    assert.equal([a, b].filter((u) => u.role === "player").length, 1);
  });
});

describe("sheet conflict + shop buy transaction (#84)", () => {
  it("rejects stale expectedUpdatedAt with CharacterConflictError", async () => {
    setupTestDatabase();
    const user = await createUser(`owner-${Date.now()}`, "password-xx1");
    const character = await createCharacter(user.id, {
      name: "Hero",
      system: "dnd5e",
      sheetData: emptyDnd5eSheet(),
    });

    await updateCharacter(character.id, { name: "Hero 2" });
    await assert.rejects(
      () =>
        updateCharacter(character.id, { name: "Hero 3" }, { expectedUpdatedAt: character.updatedAt }),
      CharacterConflictError,
    );
  });

  it("buys an item atomically (character sheet + stock)", async () => {
    setupTestDatabase();
    const dm = await createUser(`shop-dm-${Date.now()}`, "password-dm1");
    const campaign = await createCampaign(dm.id, "Shop Camp");
    await addShopItem(campaign.id, { name: "Rope", basePrice: 1, quantity: 2 });
    await updateShop(campaign.id, { isOpen: true });
    const shop = await getShop(campaign.id);
    const item = shop.items[0]!;

    const sheet = emptyDnd5eSheet();
    sheet.currency = { ...sheet.currency, gp: 10 };
    const character = await createCharacter(dm.id, {
      name: "Buyer",
      system: "dnd5e",
      campaignId: campaign.id,
      sheetData: sheet,
    });

    const result = await buyItem(campaign.id, character.id, item.id);
    const boughtSheet = result.character.sheetData as Dnd5eSheetData;
    assert.ok(boughtSheet.items.some((i) => i.name === "Rope"));
    assert.equal(result.shop.items.find((i) => i.id === item.id)?.quantity, 1);
  });
});

describe("single active encounter (#85)", () => {
  it("keeps only one active campaign encounter after sequential starts", async () => {
    setupTestDatabase();
    const dm = await createUser(`enc-dm-${Date.now()}`, "password-en1");
    const campaign = await createCampaign(dm.id, "Enc Camp");
    await startEncounter(campaign.id, "One");
    await startEncounter(campaign.id, "Two");
    const active = getActiveEncounterForCampaign(campaign.id);
    assert.ok(active);
    assert.equal(active.name, "Two");
  });

  it("keeps only one active personal encounter after sequential starts", async () => {
    setupTestDatabase();
    const user = await createUser(`solo-${Date.now()}`, "password-so1");
    await startPersonalEncounter(user.id, "Prep A");
    await startPersonalEncounter(user.id, "Prep B");
    const active = getActiveEncounterForOwner(user.id);
    assert.ok(active);
    assert.equal(active.name, "Prep B");
  });
});

describe("share token is read-only (#77)", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    setupTestDatabase();
    const app = express();
    app.use(express.json());
    app.use(createSessionMiddleware());
    app.use("/api/characters", charactersRouter);
    app.use("/api/shared/characters", sharedCharactersRouter);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  it("allows anonymous GET by token but rejects unauthenticated PATCH", async () => {
    const user = await createUser(`share-${Date.now()}`, "password-sh1");
    const sheet = emptyDnd5eSheet();
    sheet.privateNotes = "secret";
    const character = await createCharacter(user.id, {
      name: "Shared Hero",
      system: "dnd5e",
      notes: "owner notes",
      sheetData: sheet,
    });
    const token = await mintShareToken(character.id);

    const getRes = await fetch(`${baseUrl}/api/shared/characters/${token}`);
    assert.equal(getRes.status, 200);
    const body = (await getRes.json()) as { character: { notes: string | null; sheetData: Dnd5eSheetData } };
    assert.equal(body.character.notes, null);
    assert.equal(body.character.sheetData.privateNotes, "");

    const patchRes = await fetch(`${baseUrl}/api/characters/${character.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked" }),
    });
    assert.equal(patchRes.status, 401);

    const still = getCharacter(character.id)!;
    assert.equal(still.name, "Shared Hero");
  });

  it("closes the test server", async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
