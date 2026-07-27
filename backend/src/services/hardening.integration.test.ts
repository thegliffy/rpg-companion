import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import express from "express";
import type { Server } from "node:http";
import { emptyDnd5eSheet, type Dnd5eSheetData } from "shared";
import { setupTestDatabase } from "../test/harness.js";
import { createUser } from "./users.service.js";
import { createCampaign, joinCampaignByInviteCode } from "./campaigns.service.js";
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
import { campaignsRouter } from "../routes/campaigns.routes.js";
import { authRouter } from "../routes/auth.routes.js";
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

describe("campaign character list redaction (#93)", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    setupTestDatabase();
    const app = express();
    app.use(express.json());
    app.use(createSessionMiddleware());
    app.use("/api/auth", authRouter);
    app.use("/api/campaigns", campaignsRouter);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  async function loginCookie(username: string, password: string): Promise<string> {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    assert.equal(res.status, 200);
    const cookie = res.headers.get("set-cookie");
    if (!cookie) throw new Error("login did not set a cookie");
    return cookie.split(";")[0];
  }

  it("hides privateNotes from everyone but the owner, and notes from non-DM peers", async () => {
    const suffix = Date.now();
    // The first user ever created in a fresh test DB is auto-promoted to global admin (bootstrap
    // rule), and an admin legitimately bypasses all redaction -- burn that slot first so `dm`
    // below is an ordinary campaign DM, not a site admin, matching the scenario under test.
    await createUser(`redact-zeroth-${suffix}`, "password-zz-1");
    const dm = await createUser(`redact-dm-${suffix}`, "password-dm-1");
    const owner = await createUser(`redact-owner-${suffix}`, "password-ow-1");
    const peer = await createUser(`redact-peer-${suffix}`, "password-pe-1");
    const campaign = await createCampaign(dm.id, "Redaction Test Campaign");

    // Owner and peer both join as plain players; dm is already a member (campaign creator).
    await joinCampaignByInviteCode(owner.id, campaign.inviteCode);
    await joinCampaignByInviteCode(peer.id, campaign.inviteCode);

    const sheet = emptyDnd5eSheet();
    sheet.privateNotes = "secret diary";
    await createCharacter(owner.id, {
      campaignId: campaign.id,
      name: "Redaction Hero",
      system: "dnd5e",
      notes: "owner's character notes",
      sheetData: sheet,
    });

    async function listAs(cookie: string) {
      const res = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/characters`, {
        headers: { Cookie: cookie },
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { characters: { notes: string | null; sheetData: Dnd5eSheetData }[] };
      return body.characters[0];
    }

    const ownerCookie = await loginCookie(`redact-owner-${suffix}`, "password-ow-1");
    const asOwner = await listAs(ownerCookie);
    assert.equal(asOwner.sheetData.privateNotes, "secret diary");
    assert.equal(asOwner.notes, "owner's character notes");

    const dmCookie = await loginCookie(`redact-dm-${suffix}`, "password-dm-1");
    const asDm = await listAs(dmCookie);
    assert.equal(asDm.sheetData.privateNotes, "", "DM must never see privateNotes");
    assert.equal(asDm.notes, "owner's character notes", "DM should still see the general notes field");

    const peerCookie = await loginCookie(`redact-peer-${suffix}`, "password-pe-1");
    const asPeer = await listAs(peerCookie);
    assert.equal(asPeer.sheetData.privateNotes, "", "peer player must never see privateNotes");
    assert.equal(asPeer.notes, null, "peer player (not owner, not DM) must not see notes either");
  });

  it("closes the test server", async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});

describe("rate limiter fixes (#98)", () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    setupTestDatabase();
    const app = express();
    // Mirrors index.ts's production config -- required for X-Forwarded-For to drive req.ip below.
    app.set("trust proxy", true);
    app.use(express.json());
    app.use(createSessionMiddleware());
    app.use("/api/auth", authRouter);
    app.use("/api/campaigns", campaignsRouter);
    server = await new Promise<Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  it("scopes the per-username login limiter to (username, requester IP), not username alone", async () => {
    const suffix = Date.now();
    const username = `victim-${suffix}`;
    await createUser(username, "correct-password-1");

    async function loginAttempt(password: string, attackerIp: string) {
      return fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": attackerIp },
        body: JSON.stringify({ username, password }),
      });
    }

    // Attacker at one IP burns the per-(username, ip) budget with wrong passwords.
    let lastStatus = 0;
    for (let i = 0; i < 10; i++) {
      const res = await loginAttempt("wrong-password", "10.0.0.1");
      lastStatus = res.status;
    }
    assert.equal(lastStatus, 401, "the 10th wrong attempt should still be a normal auth failure");
    const blockedRes = await loginAttempt("wrong-password", "10.0.0.1");
    assert.equal(blockedRes.status, 429, "the 11th attempt from the same attacker IP should be rate-limited");

    // The real user, logging in correctly from their own (different) IP, must be unaffected.
    const realUserRes = await loginAttempt("correct-password-1", "10.0.0.2");
    assert.equal(realUserRes.status, 200, "a login for the same username from a different IP must not be blocked");
  });

  it("does not let unrelated endpoints share a rate-limit bucket", async () => {
    const attackerIp = "10.0.1.1";

    // POST /campaigns/join sits behind requireAuth, so exercising its rate limiter needs a real
    // session -- log in over HTTP (not just createUser) to get one, same as the redaction test.
    const suffix = Date.now();
    const joinUsername = `join-limit-${suffix}`;
    await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: joinUsername, password: "join-password-1" }),
    });
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: joinUsername, password: "join-password-1" }),
    });
    const sessionCookie = loginRes.headers.get("set-cookie")?.split(";")[0];
    if (!sessionCookie) throw new Error("login did not set a cookie");

    // Exhaust the campaign-join limiter (max 20) from this IP with invalid invite codes.
    for (let i = 0; i < 20; i++) {
      await fetch(`${baseUrl}/api/campaigns/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": attackerIp, Cookie: sessionCookie },
        body: JSON.stringify({ inviteCode: "NOPE" }),
      });
    }
    const joinBlockedRes = await fetch(`${baseUrl}/api/campaigns/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": attackerIp, Cookie: sessionCookie },
      body: JSON.stringify({ inviteCode: "NOPE" }),
    });
    assert.equal(joinBlockedRes.status, 429, "the join limiter's own budget should now be exhausted");

    // A registration from the SAME IP must still work -- it has its own budget (max 10), untouched
    // by the 20+ requests that went through the join limiter's bucket.
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": attackerIp },
      body: JSON.stringify({ username: `fresh-${Date.now()}`, password: "some-password-1" }),
    });
    assert.equal(registerRes.status, 201, "registration must not be blocked by an unrelated endpoint's rate limit");
  });

  it("closes the test server", async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });
});
