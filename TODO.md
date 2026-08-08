# Change backlog

Planned changes to the RPG Companion, gathered before implementation.

1. ✅ **Decouple character sheets from campaigns.** (done + deployed 2026-07-18)

## Theme: single-user experience

The app should be fully useful to one person with no campaign at all — campaigns become an optional social layer on top of personal tools, not the entry point.

2. ✅ **Personal dice roller.** (done 2026-07-18, not yet deployed) Roll from the home page without any campaign; personal roll history (user-scoped rolls, `campaign_id` nullable on `dice_rolls` like characters). No socket broadcast needed for personal rolls.

3. ✅ **Personal notes.** (done 2026-07-18, not yet deployed) Notes owned by the user with no campaign (`campaign_id` nullable on `notes`) — backstory, prep, ideas. Same markdown editor; visible only to the owner. Possibly later: attach/move a personal note into a campaign.

4. ✅ **Home page redesign around the solo user.** (done 2026-07-18, not yet deployed) Lead with "My characters" and personal tools (dice, notes); campaigns move to a secondary section. Registration should land somewhere immediately useful without joining anything.

5. ✅ **Solo encounter tracker.** (done 2026-07-18, not yet deployed) Run an initiative tracker outside any campaign (owner-only, no realtime needed) — for solo play and DM prep. Implies `encounters.campaign_id` nullable + owner_user_id, tracker UI reachable from home.

6. ✅ **5e SRD + PF2e + generic sheet systems, full-screen sheets, creation wizard.** (done + deployed 2026-07-19) Superset of the original item: system plugin architecture (generic/dnd5e/pf2e), full-screen per-system sheet pages with auto-calculated derived values, and a multi-step creation wizard with four stat methods (4d6-drop-lowest server rolls, standard array, point buy, manual). Original scope notes: **5e SRD character sheet template.** Add a "D&D 5e" sheet option that creates a character pre-loaded with the full standard 5e sheet structure instead of starting from blank custom fields: ability scores (STR/DEX/CON/INT/WIS/CHA), saving throws, all 18 skills, AC / initiative / speed, HP + hit dice + death saves, proficiency bonus, attacks/spellcasting section, spell slots by level, proficiencies & languages, features & traits, equipment, personality/ideals/bonds/flaws. Open design questions for implementation: whether derived values (ability modifiers, save/skill bonuses from proficiency) auto-calculate or stay manual inputs; whether to pull actual SRD 5.1 content (classes/races/spells — CC-BY-4.0 licensed) or just provide the empty sheet structure; whether the generic custom-fields editor remains available alongside the template (it should). Likely implies a sheet-template concept in the data model (template id on character + structured sections rather than one flat field list).

7. ✅ **Character portrait upload.** (done + deployed 2026-07-19) A picture slot at the top of the D&D 5e sheet — click to upload (jpeg/png/webp/gif, 5MB max), stored on the server's persistent volume (`data/portraits/`), auth-gated (owner or campaign-DM can upload; owner or any campaign member can view, matching the existing character-list visibility). File is cleaned up automatically when the character is deleted. Scoped to the 5e sheet only for now per user request to focus on the 5e experience; the backend (portrait column + endpoints) is system-agnostic and reusable for PF2e/generic later.

## Theme: 5e sheet depth

Focused entirely on the D&D 5e sheet (`Dnd5eSheet.tsx` + `shared/src/systems/dnd5e.ts`) — the system the user actually plays. Not touching PF2e/generic for these.

8. ✅ **Group skills by parent ability score.** (done + deployed 2026-07-19) Currently the 18 skills render as one flat two-column list. Reorganize into sections under each of the six abilities (e.g. Strength → Athletics; Dexterity → Acrobatics, Sleight of Hand, Stealth; etc.), matching how players actually scan a sheet.

9. ✅ **Spellcasting details.** (done + deployed 2026-07-19) Spellcasting ability (per class), auto-calculated spell save DC (`8 + prof + ability mod`) and spell attack bonus (`prof + ability mod`), plus a known/prepared spell list organized by level (name, level, prepared checkbox at minimum). Extends the existing spell-slots block rather than replacing it.

10. ✅ **Inventory with weight/currency.** (done + deployed 2026-07-19) Replace the plain equipment text box with a structured item list (name, quantity, weight, notes) and a currency tracker (cp/sp/gp/ep/pp) with a total-weight readout. Keep it simple — no encumbrance rules enforcement unless asked.

11. ✅ **Passive scores.** (done + deployed 2026-07-19) Auto-calculated passive Perception (`10 + Perception bonus`), and likely Investigation and Insight too, displayed near the skills block. Zero new inputs — pure derived display from existing skill proficiencies.

12. ✅ **Conditions tracker.** (done + deployed 2026-07-19) One-way sheet-to-combatant sync implemented and verified live via socket broadcast. Checkboxes for the standard 5e conditions (blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious, exhaustion with levels) on the character sheet itself. Worth wiring so the same condition tags feed into the initiative tracker's per-combatant `conditions` field when the character is in an active encounter — needs design thought on which direction sync flows (sheet → combatant snapshot, one-way, matching the existing snapshot-not-live-join pattern for HP).

## Theme: SRD spell reference + casting

13. ✅ **SRD spell dropdown (all levels 0-9).** (done + deployed 2026-07-19) Sourced all 319 spells from the open 5e-bits/5e-database project (CC-BY-4.0), trimmed to mechanical fields only, generated shared/src/systems/srd-spells.ts. When adding a spell to the 5e sheet, choose from the full SRD spell list (name, level, school, casting time, range, duration, damage dice + type where applicable, save ability or attack-roll requirement) via a dropdown, with an "Other (custom)" option that falls back to the existing free-text name entry. Given the size of the full SRD list (~300+ spells), source the data from an established open SRD dataset (CC-BY-4.0) rather than hand-transcribing from memory, to keep it accurate.

14. ✅ **Cast button with dice rolling.** (done + deployed 2026-07-19) Verified: attack-roll spells (Acid Arrow) roll 1d20+spell attack bonus then show Hit/Miss, Hit rolls damage; save-based spells (Fireball) roll damage directly. Fixed a state-leak bug where switching spells in the dropdown showed stale roll results from the previous spell. Each known spell gets a "Cast" button:
    - **Attack-roll spells** (e.g. Fire Bolt): Cast rolls `1d20 + spell attack bonus`, shows the total. Two buttons appear below the result — **Hit** and **Miss**. Hit rolls the spell's damage dice and shows the total broken out with modifiers; Miss ends it there.
    - **Save-based spells** (e.g. Fireball, Guiding Bolt): Cast just rolls the damage dice and shows the total broken out — the target's save happens at the table, not tracked here.
    - Rolls go through the existing dice-roll infrastructure (same server-side evaluation, visible in the roll feed) rather than a separate ad-hoc roller.

## Theme: smarter spell selection

15. ✅ **Class-restricted spell lists by default.** (done + deployed 2026-07-19) The spell dropdown should only offer spells actually available to the character's class (e.g. a Fighter without spellcasting features doesn't see the full wizard list; a Wizard doesn't see Cleric-only spells). Requires re-adding the per-spell class list to the SRD dataset (`srd-spells.ts` currently strips it — the raw source data already has it per spell, just needs to be pulled back in) and matching against the character's `class` field.

16. ✅ **Override toggle for the class restriction.** (done + deployed 2026-07-19) Since class restriction could be wrong (multiclass, homebrew, a feat that grants an off-list spell) or just annoying, there needs to be an explicit way to bypass it and see/pick from the full spell list.

17. ✅ **Richer spell-adding popup.** (done + deployed 2026-07-19) Replace the current inline dropdown with a modal opened via "Add spell":
    - Class selector at the top, defaulting to the character's own class (from the class-restricted list in #15, with the override from #16 available).
    - Spell picker scoped to that class's list.
    - A per-spell ability modifier choice (defaults to the sheet's spellcasting ability, but selectable independently) — covers multiclass casters and features that key off a different ability than the default.
    - Data model implication: each spell entry on the sheet gains an optional ability override (falls back to `sheet.spellcastingAbility` when unset), used by the Cast flow's attack-roll/save-DC math instead of always reading the sheet-level ability.

18. ✅ **Auto-known spell lists for prepared casters.** (done + deployed 2026-07-19; Wizard included alongside Cleric/Druid/Paladin for simplicity) In 5e SRD rules, Cleric, Druid, and Paladin don't have a fixed "spells known" list — they have access to their entire class spell list and just prepare a number of them each day. For these classes, the spell popup (#17) should auto-populate every level-appropriate spell from the class list (filtered by max spell level accessible at the character's current level) as available-to-prepare, rather than requiring them to be added one at a time like a Sorcerer/Bard/Ranger/Warlock's fixed known-spells list. Design questions: need a max-spell-level-by-character-level table (varies by full/half caster progression — Cleric/Druid are full casters, Paladin is a half caster with a different, later-starting progression); Wizard is a hybrid (spells known via spellbook, but still prepares a subset) — worth deciding whether Wizard gets this treatment or stays manual-add.

19. ✅ **Expected spells-known count for known-spell casters.** (done + deployed 2026-07-19) For Bard, Sorcerer, Ranger, and Warlock (the classes with a fixed spells-known progression rather than prepare-from-full-list), show something like "Spells known: 4 / 6" near the spell list — expected count at the character's current level (from the class's SRD spells-known-by-level table) vs. how many are actually on the sheet, so a player can tell at a glance if they're missing one or have added too many. Needs sourcing each class's known-spells-by-level table (Ranger starts at level 2, Warlock has its own curve, Bard/Sorcerer their own) — same open-dataset-sourcing approach as the spell list itself rather than hand-transcribing from memory.

20. ✅ **Expected spell slots by class/level.** (done + deployed 2026-07-19) Same idea as #19 but for the "Spell slots" block — auto-derive/display the expected total slots per spell level from the character's class + level (the standard SRD full/half/third-caster spell slot progression tables), shown alongside the manually-tracked totals so a player can verify they've got the right numbers (or have it auto-fill on level-up rather than requiring manual entry). Important wrinkle: Warlock doesn't use the standard table at all — Pact Magic gives a small number of slots that are always cast at Warlock's highest available slot level and recharge on a short rest, not long rest — so Warlock needs its own separate handling here, not just a lookup in the shared full/half/third-caster table.

21. ✅ **Short rest / long rest buttons.** (done + deployed 2026-07-19) Two buttons on the 5e sheet:
    - **Long rest**: restore HP to max, restore all spell slots (including Warlock's Pact Magic slots), reduce exhaustion by 1 level, reset available hit dice (regain up to half the character's total hit dice, minimum 1).
    - **Short rest**: spend hit dice to heal (roll the class hit die + CON modifier per die spent — needs a small "how many dice?" prompt since it's a player choice, not automatic), restore Warlock's Pact Magic slots only (they're the one class that recovers on short rest).
    - Confirmed RAW-accurate: rest buttons do NOT clear condition checkboxes (poisoned/frightened/prone/etc. end via their own source, not by resting) — only exhaustion reduces by 1 on a long rest, as noted above.

22. ✅ **Bugfix: spell slots not restoring on rest; Cast button gating.** (done + deployed 2026-07-19) The spell slot field was internally tracked as "used" but displayed first (matching the avail/total convention used elsewhere), so a long rest correctly zeroed it but the UI showed 0 instead of full availability — renamed the field to `available` throughout and relabeled the section "Spell slots (avail/total)". Also: the Cast button now only renders for spells with the "Prepared" checkbox checked, and always renders (even for spells with no attack roll or damage dice, like Guidance) — clicking Cast on a no-roll spell shows a plain "Cast." confirmation.

## Theme: global user access levels

23. ✅ **Global player / DM / admin roles.** (done + deployed 2026-07-20) New `role` column on `users` (enum `player` | `dm` | `admin`, default `player` on signup). This is a *global account-level* rank, distinct from (and sitting on top of) the existing per-campaign `campaignMemberships.role` (`dm`/`player` per campaign, unchanged) — a global DM still becomes a specific campaign's per-campaign "dm" the normal way (by creating it), this just gates *who's allowed to create a campaign in the first place*.
    - **Player** (default): can freely create/edit/delete only their own character sheets, personal notes, and personal rolls; can still join any campaign via invite code as a player, same as today.
    - **DM**: everything a player can do, plus can create campaigns (campaign creation moves from "any authenticated user" to "role dm or admin only") and invite people to them. Per-campaign DM sheet-access (view/edit any character attached to a campaign they DM) already exists via `requireCharacterOwnerOrDM` — no change needed there, it just becomes reachable once they can create campaigns.
    - **Admin**: can view and edit *everything* site-wide — every character sheet regardless of owner or attachment (including other users' personal, non-campaign characters), every campaign (including ones they're not a member of), every note. Implemented as a bypass check alongside the existing owner/DM/membership checks in the character, campaign, and note middleware, rather than replacing them.
    - **Bootstrapping**: the very first user account ever registered on the server is automatically promoted to `admin` on creation (no config needed).
    - **Migration/backfill**: a one-time migration step scans existing `campaignMemberships` for any user with role `"dm"` in at least one campaign and sets their global `role` to `dm`, so existing campaign-owners don't lose the ability to create new campaigns when this ships. Everyone else starts at `player`.
    - **Admin panel**: a new admin-only page (reachable only to `role: admin` users) listing all registered users with a dropdown per row to change their global role (player/dm/admin) — this is the only way to promote/demote after the initial bootstrap.
    - Enforcement points to update: `POST /api/campaigns` (create) gated to `dm`/`admin` instead of any authenticated user; character/campaign/note middleware extended with an admin bypass; frontend hides "Create a campaign" from plain players and shows the new admin panel link only to admins.

## Theme: races and homebrew content

24. ✅ **SRD race dropdown, and Class becomes a dropdown too.** (done + deployed 2026-07-20) Add a `race` selection to the 5e sheet/wizard sourced from the SRD race list (same sourcing approach as spells/class-progression: fetch `5e-SRD-Races.json` from the `5e-bits/5e-database` GitHub repo, CC-BY-4.0, trim to mechanical fields only — ability score bonuses per ability, speed, size, languages, short trait names — no flavor text). While doing this, **also convert the existing free-text `Class` input into a real dropdown** sourced from the existing `DND5E_CLASSES` list, on both the character sheet and the creation wizard's Basics step. Since custom/homebrew classes don't exist yet (see #25), the dropdown needs an "Other (homebrew)" option that falls back to the current free-text behavior, so nothing that works today breaks.

25. ✅ **DM-created custom races/classes, with admin approval into a global pool.** (done + deployed 2026-07-20) Depends on #23 (global roles) being built first — needs to know who's a DM/admin. New `custom_content` table: `id`, `type` (`race`|`class`), `createdByUserId`, `name`, `data` (JSON — see depth below), `status` (`pending`|`approved`), `approvedByUserId`, `approvedAt`.
    - **Scope before approval**: a DM's custom race/class is scoped to *them*, not a single campaign — usable when creating/editing characters in any campaign they're the DM of, and also on their own personal (non-campaign) characters. Not visible to anyone else until approved.
    - **After admin approval**: becomes globally selectable by everyone (in the same dropdown as the built-in SRD races/classes), attribution to the original creating DM kept for provenance; only that DM or an admin can edit/retire it afterward.
    - **Mechanical depth — full SRD-equivalent**, matching built-in content structurally rather than being a lightweight name+notes stub:
      - Custom race: name, per-ability score bonuses, speed, size, languages, traits (list).
      - Custom class: name, hit die, caster type (none/prepared/known/pact), and a full per-level progression table matching the existing `ClassLevelEntry` shape (spells known, cantrips known, spell slots by level 1-9, for levels 1-20) — the same table built-in classes already have in `shared/src/systems/class-progression.ts`. This is a substantial data-entry UI (a level-by-level grid), not a couple of fields.
    - **Admin approval queue**: a page (likely part of the admin panel from #23) listing all `pending` custom races/classes across every DM, with Approve/Reject actions.
    - **DM-side management**: the creating DM can edit or delete their own pending (not-yet-approved) custom content; once approved, edits are admin/creator-only as noted above.

## Theme: guided leveling

26. ✅ **Level Up button/flow, instead of just editing the level number.** (done + deployed 2026-07-20) The `Level` field stays as a manual number input for corrections/DM overrides (backward compatible), but a new "Level Up" button drives level → level+1 and applies everything that goes with it in one step, rather than requiring the player to separately remember to bump hit dice, click "Set to expected" for slots, etc.:
    - **Level**: `level += 1`.
    - **Hit dice**: `hitDiceTotal += 1` and `hitDiceAvailable += 1` (the new die is fresh/unspent).
    - **Max HP**: player is prompted to either roll the class hit die + CON modifier (via the existing dice-roll infrastructure, same pattern as the short-rest hit-dice UI) or take the fixed average for that die (d6→+4, d8→+5, d10→+6, d12→+7, plus CON mod) — either way the result is added to `hpMax`.
    - **Spell slots**: automatically re-applied to the new level's expected table (same logic as the existing "Set to expected for {class} lvl {level}" button), for any class with a slots table.
    - **Spells/cantrips known reminder**: if the new level increases the expected known-spells or cantrips-known count for a known-caster class, surface a short reminder (the existing "Known: X/Y" indicator already updates automatically since it's derived from level — this just needs to be visually called out at the moment of leveling, e.g. flash/highlight, prompting the player to open the spell picker).
    - **Feature names**: needs sourcing per-level feature *names* (not full rules text) from the SRD dataset (`5e-SRD-Levels.json` already has a `features` array per level entry — CC-BY-4.0, short strings only) into a new `features?: string[]` field on `ClassLevelEntry` in `class-progression.ts`. On level-up, any feature names for the new level get appended as a line to the existing freeform "Features & traits" text box (e.g. "Level 5: Extra Attack") — purely a reminder, the app doesn't model what the feature mechanically does, same as it doesn't today.
    - Depends on #24's SRD class list existing as a clean lookup key (already true today via `DND5E_CLASSES`/`CLASS_PROGRESSION`), and should account for custom classes from #25 once those exist (a custom class's own DM-authored progression table drives the same slot/known-count logic).

27. ✅ **Alignment dropdown, defaulting to True Neutral.** (done + deployed 2026-07-20) Currently a free-text input defaulting to empty string. Convert to a `<select>` with the standard 9 alignments (Lawful/Neutral/Chaotic × Good/Neutral/Evil), defaulting to "True Neutral" for new characters instead of blank — both in `dnd5eSheetSchema`'s default and the character creation wizard.

28. ✅ **Clickable skill checks and saving throws.** (done + deployed 2026-07-20) Currently the Saving throws and Skills blocks just display the computed bonus as static text. Make the skill/ability name itself clickable — clicking rolls `1d20 + bonus` through the existing dice-roll infrastructure (same `diceApi.createRoll`/campaign-vs-personal pattern used by spell casting), labeled e.g. "Acrobatics check" or "Strength save", showing up in the existing roll feed. A small inline "last roll" breakdown next to the row (similar to the Cast button's inline result) gives immediate feedback without needing to scroll to the feed. Applies to all 18 skills and all 6 saving throws.

29. ✅ **Roll history at the bottom of the character sheet.** (done + deployed 2026-07-20) The existing `DiceRoller` component (`frontend/src/components/DiceRoller.tsx` — already reused as-is by both the home page and campaign dashboard, takes a `campaignId: number | null` prop, handles both the roll-history feed and the ad-hoc roll input) gets embedded at the very bottom of the 5e sheet, scoped the same way the sheet's other rolls already are: `campaignId={character.campaignId}`. For a personal (non-campaign) character this shows just the owner's personal roll history; for a character attached to a campaign it shows that campaign's shared live feed (same convention already used for spell-cast and short-rest rolls elsewhere on this page) — no new backend filtering needed, purely reusing the existing component.

30. ✅ **Private personal notes box, hidden from DMs.** (done + deployed 2026-07-20) A new freeform textarea on the 5e sheet, positioned directly below "Personality, ideals, bonds & flaws" — for player scratch space (out-of-character notes, plans, suspicions about NPCs, etc.) that the campaign's DM specifically should *not* be able to see, unlike the rest of the sheet. This is a real exception to the existing `requireCharacterOwnerOrDM` model (where a campaign's DM currently gets full read/write access to any attached character's entire `sheetData`), so it needs backend-level redaction, not just a frontend hide: the character-fetch route must strip this field out of the returned `sheetData` whenever the requester is a DM-not-owner, and reject writes to it from anyone but the owner. A future global admin (once #23 ships) *can* still see it — this field is an exception to DM visibility specifically, not to "admin sees everything."

## Theme: account recovery

31. ✅ **Admin-initiated password reset.** (done + deployed 2026-07-20) There's currently no way to recover a lost password — no email field on accounts, no SMTP infrastructure, no self-service reset flow. Rather than building that (a real lift: email column, mail sending, reset tokens), add a "Reset password" action to the existing admin panel: an admin can directly set a new password for any user (a simple form field + submit, using the same registration bcrypt-hashing path), no email involved. Fits the actual trust model of a small self-hosted friend-group app where the admin already knows everyone. Scope: new `PATCH /api/admin/users/:id/password` route (admin-only, reuses `hashPassword`/bcrypt from `users.service.ts`), a password input + button per row in `AdminPanel.tsx`.

## Theme: character creation bugfixes

32. ✅ **Bugfix: race didn't apply ability score bonuses during character creation.** (done + deployed 2026-07-20) The wizard's `finalAbilities` was computed purely from the chosen stat-generation method (roll/array/point-buy/manual) and never factored in the selected race's ability bonuses at all — so e.g. a Dwarf's +2 CON never actually applied. Fixed: renamed the method-derived value to `baseAbilities`, added a `raceBonuses` lookup (SRD races + approved/own-pending custom races from #25), and `finalAbilities = baseAbilities + raceBonuses` is now what actually gets saved. Bonuses are shown live during creation, not just baked in silently: a summary line at the top of the Ability Scores step ("Dwarf racial bonus: CON +2 — applied automatically..."), an inline hint next to each affected ability as you assign it, and a full "14 base +2 race = 16 (+3)" breakdown on the Review step. The suggested-HP calculation also now correctly uses the post-racial CON modifier.

## Theme: equipment effects, guided ASI, lifecycle & permissions

33. ✅ **Martial class special attacks, sourced from the SRD, tied into the items system.** (done + deployed 2026-07-20) The SRD's per-level dataset (`5e-SRD-Levels.json`, already cached from earlier sourcing work) turns out to carry a structured `class_specific` block per level for six classes that was never pulled into `class-progression.ts` — only `cantripsKnown`/`spellsKnown`/`slots`/`features` were extracted originally. Extend `ClassLevelEntry` (`shared/src/systems/class-progression.ts`) with an optional `martial` field holding whichever of these apply at that level, regenerated the same way as before (Python script over the cached SRD JSON, CC-BY-4.0, mechanical fields only): Fighter (`extraAttacks`, `actionSurges`, `indomitableUses`), Barbarian (`rageCount`, `rageDamageBonus`, `brutalCriticalDice`), Rogue (`sneakAttack: {diceCount, diceValue}`), Monk (`martialArts: {diceCount, diceValue}`, `kiPoints`, `unarmoredMovement`), Paladin (`auraRange`), Ranger (`favoredEnemies`, `favoredTerrain`). The 5e sheet gets a derived-only "Martial features" panel (auto-computed from class + level, same pattern as the existing Passive Scores block — zero new inputs) showing whichever lines apply, e.g. "Extra Attacks: 1 · Action Surges: 1/rest" or "Rage: 3/day (+2 dmg)" or "Sneak Attack: 2d6". Ties into the items system (#34 below): once SRD weapon items are identifiable by equipment category, a one-click "Add to Attacks" button on a weapon inventory item pre-fills a new row in the existing freeform Attacks table with the item's name — not attempting to auto-compute the attack-roll/damage formula itself, since that depends on manually-entered proficiency/ability/magic-bonus data the sheet doesn't fully track yet.

34. ✅ **SRD magic items in the inventory, with equippable ability/AC effects.** (done + deployed 2026-07-20) The SRD's magic item data (`5e-SRD-Magic-Items.json`, 362 items) turns out to have *no* structured numeric effects — just prose descriptions ("This suit of armor is reinforced with adamantine... any critical hit against you becomes a normal hit"), unlike spells/races/classes which had clean mechanical fields. So this is scoped as: source the 362 item names + category + rarity (CC-BY-4.0, names/categories only — no prose reproduced) into a new `shared/src/systems/srd-magic-items.ts`, used as an autocomplete/dropdown when adding an inventory item (matching the existing SRD spell picker's UX), purely so players pick accurate names rather than mistyping them. Every inventory item (SRD-picked or freeform) gets three new fields: `equipped: boolean`, `abilityBonuses: Partial<Record<Dnd5eAbility, number>>`, `acBonus: number` — all manually entered by the player based on their specific item's actual rules text (no auto-computed RAW values; avoids hand-curating dozens of items and risking inaccuracy). The sheet's derived ability modifiers and AC display automatically sum in the bonuses from every `equipped: true` item on top of the base ability scores / base AC, live-updating — this is the actual mechanical payoff, the SRD list itself is just a naming convenience.

35. ✅ **Ability Score Improvement handled inside the Level Up flow.** (done + deployed 2026-07-20) Today, leveling into an ASI level (4/8/12/16/19 for most classes, plus class-specific extras like Fighter 6/14) just appends "Ability Score Improvement" as a text line to Features & traits (from #26) — the player has to remember to separately go bump their ability scores by hand. Fix: when the new level's feature list includes "Ability Score Improvement" (already detected via the existing `classLevelEntry`/`customClassLevelEntry` lookup, both built-in and custom classes), the level-up flow prompts right there: choose **+2 to one ability** or **+1 to two abilities** (with ability-picker dropdowns), or **skip (saving it for a feat)** since feats aren't modeled in this app. Applies directly to `sheet.abilities`, capped at 20 (RAW cap for ASI increases; magic items from #34 can still push a character's effective/displayed modifier above that through the separate bonus mechanism).

36. ✅ **Lock name, class, and background from player edits after creation; DM/admin can still change them.** (done + deployed 2026-07-20) Once a character exists, its owner can no longer edit these three specific fields — everything else on the sheet (abilities, HP, spells, inventory, conditions, etc.) stays fully editable as today. A DM (for characters attached to their campaign) or a global admin can still change them, matching the existing `requireCharacterOwnerOrDM` model exactly: since reaching the character edit route as a non-owner already implies DM-or-admin, the frontend only needs `disabled={isOwner}` on those three inputs, and the backend PATCH route reverts changes to `name`/`class`/`background` (silently keeping the stored value) whenever the requester is the owner — same revert-not-reject pattern already used for `privateNotes` in #30.

37. ✅ **Hall of Heroes: death and retirement.** (done + deployed 2026-07-20) New `status` field on the 5e sheet: `"active"` (default) | `"dead"` | `"retired"`. Same permission tier as everything else on the sheet (owner, DM of an attached campaign, or admin) can set it — no new bespoke permission rule. A "Hall of Heroes" section appears on the home page (personal-scoped, like "My Characters" — shows the current user's own dead/retired characters, not other users'), listing each with its portrait and a label ("Died" vs "Retired") plus the date. Clicking through opens a **read-only** view of that character's sheet and portrait (locked — no edit controls at all, matching a memorial rather than a live sheet); an explicit "Reactivate" action (same permission tier) moves a character back to active/editable if needed (DM fiat, revivify, retcon, etc.). Active characters with `status !== "active"` are excluded from the normal "My Characters" / campaign character lists, appearing only in the Hall of Heroes.

38. ✅ **Rollable death saves at 0 HP.** (done + deployed 2026-07-20) The Death saves block (`deathSaveSuccesses`/`deathSaveFailures`, currently plain number inputs incremented by hand) gets a "Roll death save" button, shown only when `hpCurrent === 0`. Clicking rolls `1d20` through the existing dice infrastructure and applies RAW: natural 20 → character regains 1 HP and stops rolling death saves entirely (back to conscious); natural 1 → counts as *two* failures; 10 or higher (not a 20) → one success; below 10 (not a 1) → one failure. Reaching 3 successes shows "Stabilized" and stops prompting further rolls (still at 0 HP, unconscious, but no longer in danger). Reaching 3 failures shows a clear "Character has died" message with a manual "Mark as dead" button wired to #37's new `status` field — not automatic, so a Feather Fall reaction, a timely Revivify, or a DM ruling can still intervene before it's locked in.

## Theme: campaign shop / economy

39. ✅ **DM-run campaign shop: buy/sell with configurable rates and finite stock.** (done + deployed 2026-07-20) A per-campaign shop the DM manages and players transact with, scoped like everything DM-facing (`requireDM`/`requireCampaignMember`, no new permission tier). Data model: a `shops` table (one per campaign — `campaignId`, `isOpen: boolean` toggle, `buyRatePercent`, `sellRatePercent`, e.g. 100 = full listed price, 50 = half) and a `shop_items` table (`shopId`, `name`, `basePrice` in gp, `quantity` — finite stock, decremented on purchase, DM can edit/restock or delete). DM gets a management view: toggle the shop open/closed, set the two rate percentages, add/edit/remove catalog items and their stock. When open, campaign members see a "Shop" tab: pick which of their own characters is transacting, browse the catalog, **Buy** (blocked if `quantity` is 0 or the character can't afford `basePrice × buyRatePercent / 100`) appends a new inventory item to that character's sheet and decrements shop stock. Since selling isn't restricted to catalog items (per prior decision), every inventory item gains a `value` field (gp, manually entered/edited by the player, defaulting to 0 for existing items) — **Sell** on any inventory item removes it (or decrements its quantity) and pays out `value × sellRatePercent / 100`. Currency math: convert the character's full `cp/sp/ep/gp/pp` holdings to a total in copper, add/subtract the transaction amount, then re-normalize back down into `pp/gp/ep/sp/cp` (greedy largest-denomination-first, like making change) rather than asking the player which coins to spend or break.

## Theme: character creation guidance

40. ✅ **Recommended stat distributions during character creation.** (done + deployed 2026-07-20) Scoped to the creation wizard only (not shown on the sheet afterward) and purely informational — no auto-assign button, the player still assigns scores by hand for all four methods (roll/array/point-buy/manual). A per-class priority order (e.g. Fighter: STR > CON > DEX; Wizard: INT > CON > DEX; Rogue: DEX > CON > INT/WIS) is curated general D&D guidance, not licensed SRD content, so it lives as its own small data table in `shared/src/systems/class-progression.ts` (or a sibling file) keyed by class name — covers the 12 core classes; unrecognized/homebrew classes just show no hint. Displayed as a one-line hint on the Ability Scores step (e.g. "Fighter — recommended priority: Strength > Constitution > Dexterity"), matching the existing pattern used for racial bonus hints (#32) — same step, same non-intrusive styling, zero new schema or persisted state.

## Theme: mundane equipment

41. ✅ **Basic SRD equipment (weapons, armor, adventuring gear) with real mechanical stats.** (done + deployed 2026-07-20) Unlike #34's magic items (prose-only, no structured numbers), the SRD's mundane equipment data (`5e-SRD-Equipment.json`, CC-BY-4.0) *does* carry clean fields per weapon/armor/gear entry: cost, weight, and for weapons specifically damage dice + damage type + properties (finesse, versatile, thrown, two-handed, etc.), for armor the AC formula (base + Dex modifier, capped or not, by armor category). Source this into a new `shared/src/systems/srd-equipment.ts` (name, category: weapon/armor/gear, cost, weight, and the weapon/armor-specific fields), merged into the same inventory-item autocomplete dropdown as #34's magic items. Picking a **weapon** auto-fills its damage dice/type directly (a flat, character-independent fact) — both into the inventory item's notes and, via #33's "Add to Attacks" button, straight into the Attacks row's Damage field, so e.g. adding "Longsword" and clicking Add to Attacks gives a real "1d8 slashing" instead of a blank field (attack *bonus* still stays manual, per #33's existing scope decision). Picking **armor** or **gear** auto-fills weight and drops the AC formula into notes as reference text (e.g. "Base AC 12 + Dex modifier (max 2)") rather than computing a live number — matches #34's existing "no auto-computed RAW values" principle, since actual AC depends on the character's current Dex modifier and which single piece of armor is treated as "worn" (not modeled today).

## Theme: backgrounds

42. ✅ **Backgrounds during character creation: SRD picker, auto-checked proficiencies, custom backgrounds.** (done + deployed 2026-07-20) Today `background` on the 5e sheet is a bare free-text field. Add a background step to the creation wizard (dropdown, same UX/pattern as the existing class and race pickers): source SRD 5.1 background data into `shared/src/systems/srd-backgrounds.ts` — worth flagging up front that the *free* SRD 5.1 document only publishes one full background, **Acolyte** (Criminal/Folk Hero/Noble/Sage/Soldier/etc. are PHB-exclusive, not OGL content, so they can't be hand-sourced the way spells/races were), so this alone is thin. To make it actually useful, extend the existing custom-content system (#25) to a third type — `"background"` alongside `race`/`class` — with the same open-submission-plus-admin-approval flow already used there (creator sees their own pending submissions, everyone sees approved ones). A custom background's structured data is lean: two granted skill proficiencies, a named feature, and optional tool proficiencies/equipment text. Whichever background is picked (SRD Acolyte, an approved custom one, or freeform "Other"), its two granted skill proficiencies are **pre-checked automatically** in the wizard's skill step the moment it's selected — shown live the same way race ability bonuses are surfaced today (#32), not silently baked in. Background stays one of the fields locked from owner edits after creation (#36 already covers it) — a DM/admin can still change it, same as name/class.

## Theme: rollable attacks

43. ✅ **Rollable attacks with ability-derived bonus.** (done + deployed 2026-07-20) The Attacks table currently has plain freeform text for both "Atk bonus" and "Damage/type" — nothing computed, nothing rollable. Replace those two freeform fields with structured ones per row: an **ability** picker (STR/DEX/etc. — covers finesse/ranged weapons choosing DEX), a manual **magic bonus** (for +1/+2/+3 weapons, default 0), and split damage into **damage dice** (e.g. "1d8") + **damage type** (e.g. "slashing"). This is a deliberate breaking change to the row shape — existing freeform bonus/damage text won't carry over, since the whole point is replacing manual entry with computed values. Attack bonus is always computed as ability modifier + proficiency bonus + magic bonus (no separate "not proficient" toggle — matches the simpler default already used for saves/skills) and shown live next to the picker, same style as the existing spell save DC/attack bonus display. Each row gets a **Roll** button mirroring the existing spell Cast flow exactly: rolls `1d20 + computed bonus`, then shows Hit/Miss buttons — Miss ends there, Hit rolls the damage dice with the magic bonus added (magic weapons buff damage too, not just the attack roll) and displays the breakdown with damage type. #33's "Add to Attacks" button and #41's weapon auto-fill get updated to populate the new `damageDice`/`damageType` fields directly (from the same SRD weapon data) instead of a single combined string.

## Theme: prepared-caster overhaul (spellbooks, daily prep, rituals)

44. ✅ **Wizard spellbooks, daily preparation with a real cap, and ritual casting.** (done + deployed 2026-07-20) A significant refinement of prepared-caster spellcasting (Wizard/Cleric/Druid/Paladin), building on the existing `sheet.spells[]` array (each entry already has a `prepared: boolean`) and the class-restricted `SpellPickerModal` (#34) — no new top-level data structures needed, just new flows around the existing ones:
    - **Wizard spellbook at creation.** A new creation-wizard step, shown only when class is Wizard: pick exactly 6 first-level spells (reusing the existing class-filtered spell picker) to seed `sheet.spells`. Up to `INT modifier + 1` (min 1) of those are marked `prepared: true` by default so a level-1 wizard is playable immediately; the rest sit in the spellbook unprepared.
    - **Wizard spellbook growth on level-up.** "Each time you gain a wizard level, you automatically add two wizard spells of your choice to your spellbook, provided you have spell slots for them" — when leveling a Wizard, the level-up flow requires picking exactly 2 new spells via the picker, filtered to spell level ≤ the level-up's new `maxPreparableSpellLevel`. Wizard-specific; other known/prepared casters keep today's reminder-only text, unchanged.
    - **Daily preparation cap after a long rest, for all four prepared casters.** Long Rest now opens a "Prepare spells" step capped at `abilityModifier(casting ability) + level` (min 1; INT for Wizard, WIS for Cleric/Druid, CHA for Paladin) — live counter, can't check more than the cap. The available list differs by class per RAW: **Wizard** chooses only from spells already in their spellbook (`sheet.spells`, any level they know); **Cleric/Druid/Paladin** choose from their *entire* class spell list in the SRD (not restricted to a personal "known" subset — divine casters don't have spellbooks), so for them the picker can surface any class-appropriate SRD spell up to their max preparable level, adding/removing `sheet.spells` entries directly to match the day's selection.
    - **Ritual casting, full RAW nuance.** Re-source the `ritual: true/false` flag into `srd-spells.ts` (stripped in the original sourcing pass, same as the class-list field was before #34.5). Ritual-tagged spells get a "Cast as ritual" option alongside the normal Cast button — no slot consumed. For **Wizards**, any ritual spell in the spellbook is castable this way even if not currently prepared; for **Cleric/Druid/Paladin**, only currently-prepared ritual spells qualify.

## Theme: structured features & traits

45. ✅ **Formalize Features & traits into a structured, effect-bearing list (reusing #49's feat machinery).** (done + deployed 2026-07-21) Today `featuresText` is one freeform blob, auto-appended to on level-up (#26) and otherwise just hand-typed. Item #49 already shipped exactly the mechanism this needs — a `featEntrySchema` (`{id, name, description, abilityBonuses, acBonus, attackBonus, damageBonus, spellDCBonus, spellAttackBonus}`) plus `featAbilityBonus`/`featBonusTotal` helpers that sum those bonuses into `effectiveAbilityScore`/`effectiveAC`/`attackBonus`/`spellSaveDC`/`spellAttackBonus` and the Attacks damage roll. So #45 is now mostly *reuse*, not net-new machinery:
    - **Shared entry shape + schema.** Rename `featEntrySchema` → `effectEntrySchema` (same fields) and use it for a new `features: EffectEntry[]` array on the sheet alongside the existing `feats: EffectEntry[]`. Both arrays are the same shape; they stay separate arrays because the physical 5e sheet separates "Feats" from "Features & Traits" and #49 already shipped a distinct Feats section.
    - **DRY the aggregation.** Generalize #49's `featAbilityBonus`/`featBonusTotal` to sum across *both* `sheet.feats` and `sheet.features` (a single helper iterating both arrays), so a trait's +1 CON flows through every derived value identically to a feat's or an equipped item's — no duplicated math. The Attacks-damage fold-in (`featBonusTotal(sheet,"damageBonus")` in the AttackRollControl call) picks up feature damage bonuses for free once the helper covers both.
    - **Preserve existing history.** `featuresText` is **kept, not replaced** — relabeled "Other notes / history" and left exactly as-is, so any accumulated level-up log text or hand-written notes on existing characters survive untouched. Nothing is migrated; the structured list simply starts empty and fills going forward.
    - **Level-up pushes structured entries.** Instead of appending `"Level N: FeatureA, FeatureB"` to `featuresText`, level-up (#26/#44/#48) pushes one blank-bonus `EffectEntry` **per feature name** (FeatureA and FeatureB as separate lines) onto `features[]`, deduped against names already present. The player fills in whatever bonuses each actually grants (most: none; some: e.g. a Fighting Style's damage, a racial trait's ability bump).
    - **Sheet UI.** A "Features & traits" section mirroring the #49 Feats section exactly — each entry is name + description + an editable bonus row + Remove, plus an "Add feature" button for manual/racial additions — rendered as its own section, visually distinct from Feats.

## Theme: HP calculation bugfix

46. ✅ **Bugfix: max HP doesn't retroactively reflect a changed CON modifier.** (done + deployed 2026-07-20) Today, leveling up computes `gained = hitDieRoll (or average) + currentConMod` and adds that one lump sum onto `hpMax` permanently — so if CON modifier later increases (ASI, a magic item, a feature bonus from #45), only *future* level-ups benefit; every previously-gained level's HP stays calculated against the old, lower CON mod. RAW says the opposite: max HP is always `(sum of hit die rolls/averages across all levels, CON excluded) + (character level × current CON modifier)` — recalculated fresh any time CON changes, retroactively across every level already gained. Fix: add `hpDiceHistory: number[]` to the sheet (one entry per level — the level-1 entry is the hit die's max value, every entry after that is whatever was rolled or averaged at that level-up, **CON not included** in any entry). A new derived function computes `hpMax = sum(hpDiceHistory) + level × abilityModifier(effectiveAbilityScore(sheet, "con"))` — using the character's current, equip/feature-inclusive CON mod, so it's automatically correct after any CON change. `hpMax`/`hpCurrent` stay manually editable as today (a DM may still want to override for temp HP, special effects, etc.), but the sheet shows a "Recalculate max HP" hint + button whenever the stored `hpMax` doesn't match the formula's result — same UX convention already used for spell slots' "Set to expected" button — so mismatches are surfaced, not silently fixed out from under a deliberate override. Level-up and the character creation wizard both push into `hpDiceHistory` (die-only amount, no CON folded in) instead of adding a CON-inclusive lump sum directly to `hpMax`.

## Theme: subraces, subclasses, feats

47. ✅ **Subraces via the custom-content system + SRD data.** (done + deployed 2026-07-20) Extend the existing custom-content system (#25) with a fourth type — `"subrace"` alongside `race`/`class`/`background` — same open-submission-plus-admin-approval flow. A custom subrace's structured data: `{parentRace, abilityBonuses: Partial<Record<Dnd5eAbility, number>>, speed?: number, traits: string[]}`. Source the 4 SRD subraces (Hill Dwarf, High Elf, Lightfoot Halfling, Rock Gnome) into `shared/src/systems/srd-subraces.ts` (`{id, name, parentRace, abilityBonuses, traits}`). In the creation wizard, once a race is chosen, a **Subrace** dropdown appears filtered to subraces whose `parentRace` matches (SRD + approved custom + own pending); hidden/empty when the race has no subraces. Its ability bonuses stack **on top of** the race's, folded into `finalAbilities` the same way race bonuses already are (#32/#42), shown live with the same hint styling. New `subrace: string` field on the 5e sheet, displayed in the header next to race, and included in the owner-edit-lock set (#36 — a player can't change subrace after creation, DM/admin can). Custom-content manager gets a subrace form (parent race dropdown + ability-bonus inputs + traits); admin approval queue already renders generically.

48. ✅ **Subclasses via the custom-content system + SRD data.** (done + deployed 2026-07-20) Extend custom-content with a `"subclass"` type. Data: `{parentClass, levels: ClassLevelEntry[]}` — reuses the exact same per-level `features[]` shape custom classes already use (#25), so a subclass grants named features at chosen levels. Source the 12 SRD subclasses (one per class: Champion, Life domain, Berserker, Thief, Evocation, etc.) into `shared/src/systems/srd-subclasses.ts` (`{id, name, parentClass, levels}`) — feature names only, no rules text. On the 5e sheet, a **Subclass** dropdown filtered to the character's class (SRD + custom); stored as `subclass: string`, shown in the header. Its per-level feature names feed the existing Level Up flow (#26/#44) — when leveling, the subclass's features for the new level append alongside the class's, using the same `effectiveLevelEntry`-style lookup already built for custom classes. Subclass is **not** in the owner-lock set (unlike class itself) since 5e picks subclass a level or two into play — a player choosing their own subclass mid-progression is expected. Custom-content manager gets a subclass form reusing the existing class level-progression row editor.

49. ✅ **Feats via custom-content, with structured bonuses and ASI-flow integration.** (done + deployed 2026-07-20) Extend custom-content with a `"feat"` type. Data carries the same effect-bonus shape planned for #45's features: `{description, abilityBonuses: Partial<Record<Dnd5eAbility, number>>, acBonus, attackBonus, damageBonus, spellDCBonus, spellAttackBonusBonus}` — all manually entered. Source the single SRD feat (Grappler) into `shared/src/systems/srd-feats.ts`. New `feats: FeatEntry[]` array on the 5e sheet — each entry `{id, name, description, + the bonus fields}`. The bonuses aggregate into the character's derived values exactly like equipped items already do (#34/#43): extend `effectiveAbilityScore`/`effectiveAC`/`attackBonus`/`spellSaveDC`/`spellAttackBonus` to also sum every feat's bonuses (feats are always active, no equip toggle). Two ways to gain a feat: (1) standalone — an "Add feat" control on the sheet picks from the feat list (SRD + approved custom + own pending) or adds a blank custom one; (2) at level-up — #35's ASI step's "skip (save for a feat)" option becomes **"take a feat"**, which opens the feat picker and pushes the chosen feat onto `sheet.feats` (half-feats' +1 ability bonus then flows through automatically). Establishes the shared effect-aggregation helper that #45's features can later reuse rather than duplicating.

## Theme: Druid Wild Shape

50. ✅ **Druid Wild Shape system (beast panel, level-filtered).** (done + deployed 2026-07-20) Source the 87 SRD beasts (`5e-SRD-Monsters.json` filtered to `type: "beast"`, CC-BY-4.0) into `shared/src/systems/srd-beasts.ts` — mechanical fields only (`id, name, size, cr, ac, hp, hitDice, speed{walk/fly/swim/climb/burrow}, str/dex/con/int/wis/cha, passivePerception, attacks[]`), with attacks built from the structured `attack_bonus`/`damage_dice`/`damage_type` (damage dice already bake in the beast's modifier, e.g. "2d4+2", so they're directly rollable; skip Multiattack entries that have no attack bonus). Add `wildShape: {beastId, hpCurrent, hpMax, usesAvailable}` to the 5e sheet schema. On the sheet, a **Wild Shape** section appears only for Druids (built-in class) at level ≥ 2. When not transformed it shows a beast picker auto-filtered to the druid's level per RAW (`maxWildShapeCR`: CR ≤ 1/4 at L2, 1/2 at L4, 1 at L8; no flying speed until L8, no swimming until L4) via `wildShapeEligible`, with a "show all beasts" override toggle, plus a uses counter (2, restored on short/long rest — wire into the existing rest buttons). **Transform** (disabled at 0 uses) decrements a use, snapshots the beast's HP into `wildShape.hpCurrent/hpMax`, and switches the section to a **beast panel** — the chosen beast's stat block shown separately (name, size, CR, AC, speed, senses/passive Perception, STR/DEX/CON with a note that INT/WIS/CHA and proficiencies stay the druid's), a beast-HP tracker (current/max, editable, damage goes here while shaped), and the beast's attacks each rendered with the existing `AttackRollControl` (attackBonus from the stat block, damage dice rolled directly). A **Revert** button clears `beastId` and returns to the picker; when beast HP hits 0 the panel surfaces a "reverted (0 HP)" prompt. Deliberately a *separate panel* rather than a full stat override — the druid's own sheet (its AC, ability mods, HP, attacks) stays untouched for reference, avoiding a fragile conditional rewrite of every derived value. Scoped to built-in Druid; the initiative-tracker HP sync is out of scope for v1.

## Theme: dice roller UX

51. ✅ **Dice roller → chat-style (scrollable history, input pinned at bottom).** (done + deployed 2026-07-21) The shared `DiceRoller` component ([frontend/src/components/DiceRoller.tsx](frontend/src/components/DiceRoller.tsx)) currently renders heading → roll form → an unbounded `<ul>` history (up to 50 rolls). Rework it into a chat-box layout: heading, then the roll history as a **fixed-height, `overflow-y: auto` scrollable list** (e.g. ~240px, newest at the bottom so it reads like a log), then the roll input form **pinned beneath** the history. Because the component is shared, this updates all three mounts uniformly — home ([CampaignList.tsx:79](frontend/src/pages/CampaignList.tsx:79)), campaign dashboard ([CampaignDashboard.tsx:80](frontend/src/pages/CampaignDashboard.tsx:80)), and the bottom of the 5e sheet ([Dnd5eSheet.tsx:1840](frontend/src/components/systems/Dnd5eSheet.tsx:1840)). Auto-scroll the history to the newest entry on mount and whenever a new roll arrives (socket `roll:created` or a local roll). Pure presentational change — no API/schema/socket changes; the existing 50-roll cap and live-feed wiring stay as-is. Small, self-contained; good first item of the batch.

## Theme: Bestiary + Arena

52. ✅ **Bestiary: full SRD monster reference (~334).** (done + deployed 2026-07-21) Source the complete SRD monster set from `5e-SRD-Monsters.json` (CC-BY-4.0, same pipeline as the #50 beasts) into a new `shared/src/systems/srd-monsters.ts` — a superset of the current beast data with `type` retained (beast/dragon/undead/humanoid/fiend/…). Fields: the mechanical block already used for beasts (`id, name, size, type, cr, ac, hp, hitDice, speed, str/dex/con/int/wis/cha, passivePerception, attacks[]`) **plus** reference fields the SRD licenses us to show — `alignment, xp, senses, damageResistances/Immunities/Vulnerabilities, conditionImmunities, specialAbilities: {name, desc}[], actions: {name, desc, attackBonus?, damageDice?, damageType?}[]`. **Unify the source of truth:** make `srd-monsters.ts` the full list and have Wild Shape's `SRD_BEASTS` derive from it (`SRD_MONSTERS.filter(m => m.type === "beast")`) so there's one dataset; keep the existing `SrdBeast` fields/ids stable and **re-verify Wild Shape** (item #50's filtering + transform + attack roll) after the refactor, since it now reads a derived list. UI: a new top-level **Bestiary** page reachable from the home nav (global reference, not campaign-scoped) — a searchable/filterable list (by name, CR, type) that opens a full stat-block view per monster (abilities with mods, AC/HP/speed/senses, resistances/immunities, special abilities, and actions with their attack/damage lines rollable through the existing dice API where structured data exists). Read-only reference; feeds the Arena (#53).

53. ✅ **Arena: turn-by-turn assisted 1v1 simulator.** (done + deployed 2026-07-21) A new standalone **Arena** page (owner-only, ephemeral/in-memory like the solo encounter tracker #15 — no new DB tables in v1). Pick **side A** = one of your characters (stat block pulled live from its 5e sheet: `effectiveAC`, HP from `hpMax`, `attackBonus`/attacks, saves, spell attack/DC) and **side B** = either a Bestiary monster (#52) or another of your characters. On "Start", roll initiative for each (`1d20 + DEX mod`, monsters use their DEX) to set turn order, and load both HP pools. Each combatant's turn shows action buttons driven by **that combatant's own stat block**: pick an attack → the app rolls `1d20 + attackBonus` through the dice API, **auto-compares to the defender's AC** to show Hit/Miss, and on a hit rolls the damage dice and **auto-subtracts from the defender's HP** (with a manual HP nudge for edge cases the sim doesn't model — saves, resistances, conditions). A running **combat log** records each action ("Ragnar's Longsword: 18 vs AC 15 — hit, 9 slashing; Wolf 11→2 HP"). Detect and announce a winner when a side hits 0 HP; a "Reset" restarts. Reuses the sheet's derived-value functions and the monster attack data directly — the new piece is the resolution layer (compare-to-AC + auto-apply-damage + turn/log state), a light extension of the existing `AttackRollControl`. Depends on #52 for the monster side.

## Theme: Warlock depth

54. ✅ **Warlock pact system build-out (invocations, Pact Boon, Mystic Arcanum).** (done + deployed 2026-07-21) Pact Magic slot mechanics already work (short-rest recharge, #36); this fleshes out the *features* that are currently just level-up labels. Three parts, reusing existing machinery:
    - **Eldritch Invocations.** Source the SRD Eldritch Invocations into `shared/src/systems/srd-invocations.ts` (`{id, name, description, prereqLevel?, prereqPact?}` — names + the SRD's own text, CC-BY-4.0). A Warlock-only "Invocations" picker on the sheet (mirroring the #49 `FeatPickerModal`) that adds a chosen invocation into the structured `features[]` list (#45), carrying any structured bonuses where one cleanly maps (most are situational and add as blank-bonus reference entries). Show an expected-count indicator ("Invocations known: 2 at L2 … up to 8", from the progression table) like the spells-known hint (#35).
    - **Mystic Arcanum.** At warlock levels 11/13/15/17 the character learns one 6th/7th/8th/9th-level spell each, castable **once per long rest** outside Pact Magic slots. A small `mysticArcanum: {level: 6|7|8|9, spellName: string, used: boolean}[]` tracker on the sheet — pick the spell per arcanum tier, a used/available toggle, all reset on **long** rest (wire into `longRest()`). Only shown for Warlocks of sufficient level.
    - **Pact Boon.** A `pactBoon: "" | "chain" | "blade" | "tome"` choice (dropdown, shown once "Pact Boon" is reached at L3), stored on the sheet and displayed in the header/features area. Minimal mechanics in v1 (a labeled choice + description); Tome/Chain cantrip/familiar hooks noted as future nicety.

## Theme: campaign management

55. ✅ **Delete a campaign.** (done + deployed 2026-07-21) No delete path exists today. Add `DELETE /api/campaigns/:id` restricted to the campaign **creator** (`campaigns.createdByUserId`) or a **global admin** (not every DM — deletion is destructive), plus a "Delete campaign" control in the campaign dashboard/settings behind a confirmation (type-the-name or an explicit confirm dialog). Because several tables FK to `campaigns.id` and SQLite FK enforcement will block a bare delete, the service must tear down children in one transaction, in order: campaign `memberships`, `notes`, `encounters` **and their `combatants`**, the campaign `shop` **and its `shop_items`**, and campaign-scoped `dice_rolls`. **Do not delete attached characters** — they're user-owned and decoupled (#1/#10); instead **detach** them by nulling `characters.campaignId`, so a shared PC survives its campaign being deleted. Frontend: a `deleteCampaign(id)` API call + a guarded button that navigates back to the campaign list on success and refreshes it. Small but touches multiple services; keep the teardown centralized in one `campaigns.service.ts` function.

## Theme: sharing

56. ✅ **Public read-only share links for character sheets (all systems).** (superseded by #77/#78, done + verified locally 2026-07-23 — see those items) Let an owner mint an unguessable link that renders their character sheet to anyone — logged in or not — as a view-only page they can't edit.
    - **Schema.** Add `shareToken: text("share_token").unique()` (nullable) to `characters`. Migration is a plain `ALTER TABLE ADD COLUMN` + `CREATE UNIQUE INDEX` — **inspect the generated SQL** (drizzle has table-recreated before). NULL = not shared; SQLite allows many NULLs under a unique index.
    - **Owner controls (authenticated, owner-only — not DM).** `POST /api/characters/:id/share` generates a token (`crypto.randomBytes(16).toString("hex")`, 32 chars) and returns it; calling again returns the existing token, with a `?regenerate=1` (or separate action) that mints a fresh one and **immediately invalidates the old URL**. `DELETE /api/characters/:id/share` nulls the token (revoke). The owner's own `getCharacter` response includes `shareToken` so the sheet UI can show the link.
    - **Public route (UNAUTHENTICATED).** A new `shareRouter` mounted at `/api/share` **without `requireAuth`** (each existing router carries its own auth, so this is a clean addition alongside them). `GET /api/share/:token` looks up the character by token (404 if none/revoked) and returns a **minimal public projection**: `name, system, hpCurrent, hpMax, sheetData` with 5e `privateNotes` stripped (reuse the existing `redactPrivateNotesIfNotOwner` logic, but unconditionally) and **no** `ownerUserId`/owner identity. `GET /api/share/:token/portrait` serves the portrait file for a shared character (public mirror of the auth-gated `/:id/portrait`). Read-only by construction — no token ever grants a write, and `privateNotes` never leaves the server for a shared sheet.
    - **Public page (renders BEFORE the login gate).** The SPA fallback already serves `index.html` for any non-`/api` path, so `/share/<token>` deep-links work cold. In `App.tsx`/`main.tsx`, detect `window.location.pathname` matching `^/share/(.+)$` **before** the `if (!user) return <AuthPage/>` gate and render a standalone `SharedCharacterPage` (no app header/nav/logout) that fetches `/api/share/:token` and renders the sheet `readOnly`, with a small "Shared character — read-only" banner. Build a synthetic `Character` object from the payload to feed the existing sheet components.
    - **Read-only for all three sheets.** `Dnd5eSheet` already has a complete `readOnly` prop; **add the same prop to `Pf2eSheet` and `GenericSheet`** (disable inputs via a `fieldset disabled`, hide Save) and pass it through from both `SharedCharacterPage` and `CharacterSheetPage` (the latter currently only wires readOnly for 5e memorial view — nice consistency win).
    - **Suppress rolls & fix portrait source in shared mode.** Rollable controls (`AttackRollControl`, `SpellCastControl`, clickable skills/saves) POST to `/api/rolls` (auth) — in the anonymous shared view they'd 401, so ensure `readOnly` **hides** those roll affordances, not just disables the fieldset. `CharacterPortrait` fetches `/api/characters/:id/portrait` (auth-gated); give it a `portraitUrl` override so the shared page points it at `/api/share/:token/portrait`.
    - **Owner UI.** A small "Share" section on the sheet (owner only, non-readOnly): a button to enable the link, then the full URL (`https://<host>/share/<token>`) with a copy button, plus "Regenerate" and "Revoke". Live, not a snapshot — the link always reflects the latest saved sheet.

## Theme: custom content revamp (system-scoped, full SRD parity)

Goal: any 5e custom content should carry the same depth and fields as the pre-generated (SRD) content, and custom content should belong to a game system. Gap analysis found race/subrace/subclass/background/feat already at (or above) SRD parity; the real work is the class martial block, three brand-new custom types (spell/item/monster) so every SRD category has a homebrew counterpart, and a `system` dimension. Order matters: #57 is the foundation for the rest.

57. ✅ **System-scope custom content.** (done + deployed 2026-07-21) Add a `system` column to `custom_content` (`text("system").notNull().default("dnd5e")` — existing rows are all 5e) — plain `ALTER TABLE ADD COLUMN`, **inspect the generated SQL**. `createCustomContentSchema` gains `system` (enum of `SYSTEM_IDS`, default `dnd5e`); the valid `type` set becomes a function of the system (5e: race/subrace/class/subclass/background/feat + the new spell/item/monster from #59–61; pf2e/generic: none for now, so the manager simply shows "no custom types for this system yet"). Listing endpoints and the `useCustomContent` hook filter by the viewing character's / manager's selected system, and every sheet picker (race/class/subrace/subclass/background/feat, plus the new ones) only merges custom content whose `system` matches the character's `system`. `CustomContentManager` gets a system selector at top that drives which type options and forms appear. No behavior change for existing 5e content — it just becomes explicitly tagged `dnd5e`.

58. ✅ **Class martial block parity (custom classes).** (done + deployed 2026-07-21) Extend `classLevelEntrySchema` (used by both custom classes and subclasses) with an optional `martial` object mirroring the SRD `MartialLevelEntry` exactly — `extraAttacks, actionSurges, indomitableUses, rageCount, rageDamageBonus, brutalCriticalDice, sneakAttack {diceCount,diceValue}, martialArts {diceCount,diceValue}, kiPoints, unarmoredMovement, auraRange, favoredEnemies, favoredTerrain` (all optional). Add a collapsible "Martial features" editor to each level row in the `CustomContentManager` class/subclass form. Wire it through: the sheet's martial-feature display (#33, `martialFeatureLines`/`classLevelEntry`) already reads `entry.martial` for SRD classes — make the custom-class path (`customClassLevelEntry`/`effectiveLevelEntry`) surface the same `martial` block so a homebrew Barbarian/Monk/Rogue-like class shows rage count, martial-arts dice, sneak-attack dice, etc. identically to an SRD class. Enum-only, no migration.

59. ✅ **Custom spells.** (done + deployed 2026-07-21) New `"spell"` custom type with the full `SrdSpell` field set — `level, school, castingTime, range, duration, requiresAttackRoll?, saveAbility?, damageDice?, damageType?, ritual?, classes[]` — validated by a `customSpellDataSchema`. Manager form exposes all of it (class multi-select drives which casters can learn it). `SpellPickerModal` (currently SRD-only) merges approved + own-pending custom spells for the character's class alongside `SRD_SPELLS`, using the same class-restriction and level-cap logic; a picked custom spell copies its fields onto the sheet spell entry (reuse the `srdId` reference slot, or a parallel `customId`). Feeds ritual casting and the Cast control for free since those key off the same fields. Type-enum addition, no migration.

60. ✅ **Custom items / equipment.** (done + deployed 2026-07-21) New `"item"` custom type spanning the SRD item categories — a `kind` discriminator (`weapon | armor | gear | magic`) plus the matching fields from `SrdWeapon`/`SrdArmor`/`SrdGear`/`SrdMagicItem` (damage dice/type + properties; baseAC/dexBonus/maxDexBonus/stealthDisadvantage; weight/cost; rarity/category) **and** the structured `effectBonuses` (abilityBonuses/acBonus/etc.) an equipped item already applies (#34). Manager form switches fields on `kind`. The SRD item pickers on the sheet (weapons/armor/gear/magic-item dropdowns, #41/#48) merge in matching custom items; picking one copies its stats + equip bonuses onto the inventory entry, so a homebrew +1 sword or bespoke armor drives AC/attack/damage exactly like an SRD item. Type-enum addition, no migration.

61. ✅ **Custom monsters.** (done + deployed 2026-07-21) New `"monster"` custom type carrying the Bestiary stat-block fields (`size, type, cr, ac, hp, hitDice, speed, str..cha, senses/passivePerception, attacks[{name,attackBonus,damageDice,damageType}]`, plus optional specialAbilities/actions text) — a `customMonsterDataSchema` mirroring `SrdMonster`. Manager form with an attacks sub-editor. The **Bestiary** (#52) and **Arena** (#53), which currently read the static `SRD_MONSTERS` array, fetch approved custom monsters and merge them into the list (Arena's `combatantFromMonster` resolves either source); custom monsters are visually tagged "homebrew". This also implicitly extends Wild Shape's beast pool if a custom monster is `type: "beast"` and CR-eligible — decide whether to include custom beasts there (default: yes, same filter). Type-enum addition, no migration.

## Theme: richer background builder (fixed + choice grants, variants)

Goal: let a homebrew background read like a real one — e.g. "Insight and one Int/Wis/Cha skill of your choice", "two languages of your choice", equipment + starting gold, and a "choose one" set of themed variant boxes — and have those choices actually resolve onto the sheet at character creation. Today `customBackgroundDataSchema` is only flat *fixed* lists (`skillProficiencies:string[]`, `feature:string`, `toolProficiencies:string[]`, `equipmentText:string`), so it can't express choices, languages, or gold at all. Split into authoring (#62, independently useful) then resolution (#63).

62. ✅ **Structured background schema + authoring builder.** (done + deployed 2026-07-22) Redesign `customBackgroundDataSchema` from flat fixed lists into **fixed + choice grant blocks**, and rebuild the manager form around them so authoring a real background isn't freeform typing:
    - **New shape** (with a backward-compat shim so existing flat-shape rows and the minimal `SrdBackground` still parse — `custom_content.data` is JSON, no DB migration; a `z.preprocess` upgrades the legacy `{skillProficiencies, feature, toolProficiencies, equipmentText}` into the new shape):
        - `skills: { fixed: string[]; choices: { count: number; from: { kind: "list"; skillIds: string[] } | { kind: "ability"; abilities: Dnd5eAbility[] } | { kind: "any" } }[] }` — covers "Insight **and** one Int/Wis/Cha skill" (fixed `["insight"]` + one choice `{count:1, from:{kind:"ability", abilities:["int","wis","cha"]}}`).
        - `tools: { fixed: string[]; choices: { count: number; from: string[] }[] }` — "None" = both empty.
        - `languages: { fixed: string[]; anyCount: number }` — "Two of your choice" = `anyCount:2`.
        - `equipment: { items: string[]; gold: number }` — repeatable item rows + a starting-gold number.
        - `feature: { name: string; description: string }` — description is new (today it's just a name).
        - `variants: { id: string; title: string; description: string }[]` + `variantPickCount` (default 1) — the "lore boxes": a pick-one set of themed flavor options (v1 is flavor-only title+description; a small mechanical tweak per variant is a noted future extension).
    - **Manager form** gets a structured sub-editor per block: fixed-skill checkboxes from the 18 (grouped by ability) + repeatable "choose N from [specific list | ability group | any]" choice rows; a languages `anyCount` number + optional fixed languages; a tools fixed+choice editor; an equipment item-row list + gold field; feature name + description; a repeatable variant-card list.
    - **Authoring aids (the "make it easier" win):** a **"Start from an SRD background"** dropdown that clones an existing background's grants into the blocks to tweak, and a **live preview pane** rendering the background block the way the player will read it, updating as you edit.
    - Sheet/wizard just *display* the richer block in this item; actually applying the choices is #63.

63. ✅ **Resolve background choices onto the sheet at character creation.** (done + deployed 2026-07-22) Extend the creation wizard's background step so that picking a background with choices/variants prompts the player and writes the results to the sheet (today only a background's *fixed* skill ids are applied, via `backgroundSkillIds` → `skillProficiencies`):
    - Render one control per unresolved choice: skill-choice dropdowns filtered by the choice's `from` (list/ability/any, excluding already-granted skills); a language picker for `anyCount` slots (choose from the language list or free-enter); tool-choice dropdowns; and the **variant "pick one"** as selectable cards.
    - **Block "Next"/create** until every required choice is satisfied (validation), mirroring how point-buy/ability steps gate progression.
    - **Apply on create:** fixed + chosen skills → `sheet.skillProficiencies`; chosen languages + tools appended to `proficienciesText`; the feature (+ chosen variant title/text) pushed as a structured `features[]` entry (#45) and/or `featuresText`; equipment `items` → `sheet.items`; `gold` → `sheet.currency.gp`.
    - SRD backgrounds (which are all-fixed, no choices) flow through unchanged. Enriching the built-in SRD background data with real language/equipment/gold grants is an optional follow-on, not required here.

## Theme: spellcasting slot tracking + sheet auto-save

Goal: make the 5e sheet behave like live play — cantrips always castable (no prepared flag), casting a leveled spell actually spends a slot, the cast button warns when you're out, and every change persists automatically so nothing is lost by forgetting to hit Save. All frontend; no schema/DB migration (the `spellSlots`/`spells` shapes already exist). Build 64→66 together (all touch the spellcasting section of `Dnd5eSheet.tsx`), 67 is independent.

64. ✅ **Cantrips have no prepared flag and are always castable.** (done + verified locally 2026-07-22) Cantrips (`spell.level === 0`) are always "on" in 5e — remove the per-cantrip **Prepared** checkbox in the sheet's spell list and treat them as permanently prepared everywhere the "is it castable" question is asked. Concretely in `Dnd5eSheet.tsx`: hide the Prepared `<label>` when `sp.level === 0`; introduce `preparedOrCantrip = sp.prepared || sp.level === 0` and use it in the `SpellCastControl` gate (currently `sp.prepared || (srdSpell.ritual && isWizardCaster)`) and its `ritualOnly={!sp.prepared}` prop, so a freshly-added cantrip shows its Cast control immediately (today it's hidden until Prepared is checked — the actual bug). The `prepared` field stays on the schema (ignored for level 0) — no migration, old cantrips with either value behave identically. Counters already exclude cantrips from "spells prepared" (they're counted only under "cantrips known"), so no counter change.

65. ✅ **Casting a leveled spell spends a spell slot.** (done + verified locally 2026-07-22) Wire the Cast button to `sheet.spellSlots`. On casting a **leveled, non-ritual** spell, spend the **lowest available slot at or above the spell's level** (its own level first, stepping up only when exhausted — this is what makes Fireball-with-a-higher-slot and Warlock Pact Magic slots both work, since pact slots live in the same `spellSlots` array). Decrement `available` by 1 once per cast, at the moment of casting, regardless of the attack hit/miss outcome. Cantrips (#64) and ritual casts (`ritualOnly`) never consume a slot. Implementation: the parent (`Dnd5eSheet`) computes per row the target slot (`spellSlots.filter(s => s.level >= sp.level && s.available > 0)` → lowest level) + a decrement callback, passed into `SpellCastControl` as new props (`consumesSlot`, `hasSlot`, `onConsumeSlot`).

66. ✅ **Cast button turns red when out of slots.** (done + verified locally 2026-07-22) When a leveled spell has **no available slot at or above its level**, style the Cast button red as a visual warning. Keep it **clickable** (still rolls the dice / spends nothing — matches "turn it red," not "disable it"; the DM may be spending a feature or upcasting off-sheet). Cantrips and rituals never go red. Uses the `hasSlot`/`consumesSlot` props from #65.

67. ✅ **Sheet auto-saves after each action.** (done + verified locally 2026-07-22) Replace the manual "Save sheet" workflow with debounced sheet-wide auto-save so changes (checkbox toggles, casts spending a slot, added/removed spells/items, edited fields) persist without clicking Save. Implementation in `Dnd5eSheet.tsx`: a debounced (~1s) effect watching `sheet` + `name` + `hpCurrent` + `hpMax` that calls `updateCharacter` with the same payload `save()` sends today; skip the initial mount; one save in-flight at a time with a re-run if more changes land mid-save; **flush any pending save on unmount** so a just-spent slot or last edit can't be lost by navigating away. Fold today's immediate-persist paths (rests, status changes) into the same mechanism — they just `setSheet` and let the effect persist, removing the current double-write. Convert the **"Save sheet"** button into a **status indicator** ("Saving… / All changes saved / Save failed — Retry"), keeping a manual retry on error.

**Future (not scheduled): upcast effect scaling.** Casting a spell with a higher-level slot (#65) spends the bigger slot but still rolls the spell's *base* dice — actual scaling (Fireball's +1d6 per slot level above 3rd, higher-level effects, scaling targets) is a larger "rework spellcasting" effort: needs per-spell upcast metadata (`SrdSpell` has none today) and a slot-level chooser on the Cast control. Log here as a known gap, not part of 64–67.

## Theme: Warlock pacts & invocations that actually do something

Goal: today the whole Warlock pact/invocation layer is **flavor-only text** — the schema comment on `pactBoon` even says "Purely a labeled choice in v1 — no mechanical hooks", and picked invocations are stored as `features[]` entries with *blank* bonus fields. Make pacts and invocations mechanically live: grant skills, add spells, drive Eldritch Blast, seed a pact weapon, and give Pact of the Chain a real familiar. Reuses the existing effect-aggregation pipeline (`effectEntrySchema` → `featBonusTotal`/`featAbilityBonus` → AC/attack/DC), the always-castable-cantrip + slot-consumption work (#64–66), the rollable-attacks block (#43), and the Wild Shape companion panel (a direct precedent for the familiar). Build 68 first (foundation), then 69–71 in any order, 72 is polish. No DB migration — all sheet-JSON + static-data changes.

68. ✅ **Structured invocation & pact-boon effects (foundation: skill + spell grants).** (done + verified locally 2026-07-23) Give invocations and pact boons a real mechanical payload instead of description text.
    - **Extend `SrdInvocation`** (`srd-invocations.ts`) with an optional `grants` object: the existing effect numeric fields (`abilityBonuses`, `acBonus`, `attackBonus`, `damageBonus`, `spellDCBonus`, `spellAttackBonus`) **plus** `skillProficiencies?: string[]`, `grantedSpells?: { name: string; srdId?: string; level: number; atWill?: boolean }[]`, `sensesText?: string`, and EB-modifier flags (`ebDamagePerBeamAbility?`, `ebRangeFeet?`, `ebPush?`) consumed by #69. Populate `grants` for every SRD invocation that has a mechanical effect — e.g. Beguiling Influence → `skillProficiencies: ["deception","persuasion"]`; Armor of Shadows / Eldritch Sight / Mask of Many Faces / Misty Visions / Fiendish Vigor / Ascendant Step / Otherworldly Leap / Whispers of the Grave / Master of Myriad Forms / Visions of Distant Realms → `grantedSpells` (at-will, `atWill: true`); Devil's Sight → `sensesText: "Darkvision 120 ft (magical + nonmagical)"`; Agonizing Blast / Eldritch Spear / Repelling Blast → EB-modifier flags.
    - **Extend `effectEntrySchema`** (`dnd5e.ts`) with `skillProficiencies: string[]` so the `features[]` entry an invocation becomes on pick can carry granted skills; add an `effectSkillProficiencies(sheet)` helper and make **both** the skill checkbox display and `skillBonus()` treat a skill as proficient if it's in `sheet.skillProficiencies` **or** granted by any feat/feature (a granted skill's box shows checked + a small "(from invocation)" marker, and un-granting is automatic when the invocation is removed — no orphaned proficiency).
    - **Granted spells:** add an `atWill: boolean` (default false) flag to `spellSchema`; on picking an invocation with `grantedSpells`, push them into `sheet.spells` tagged with the source invocation id (so removal cleans them up) and `atWill: true` where applicable. Extend #65's `consumesSlot` guard to `level >= 1 && prepared && !atWill` so at-will invocation spells (e.g. Armor of Shadows = mage armor at will) never spend a slot and never go red.
    - **`InvocationPickerModal`** already exists; on pick/remove it now applies/reverts the full `grants` (bonuses via the features entry, skills, spells, senses). Show `sensesText` in a small "Senses" line in the Pact Magic block.

69. ✅ **Eldritch Blast as a first-class cantrip.** (done + verified locally 2026-07-23) Detect the EB spell entry by `srdId === "eldritch-blast"` and give it a dedicated cast control (a variant of `SpellCastControl`) that: rolls **N beams** by character level (1 at L1, 2 at L5, 3 at L11, 4 at L17 — a `eldritchBlastBeams(level)` helper), each beam its own attack roll (spell attack bonus) + `1d10` force; when **Agonizing Blast** is known (scan `features[]`/invocation grants for the `ebDamagePerBeamAbility` flag) add the CHA modifier to **each beam's** damage; annotate range 300 ft when **Eldritch Spear** is known and a "push 10 ft" note when **Repelling Blast** is known. This is the iconic Warlock damage mechanic and the most-felt gap. Non-warlocks who somehow have EB just get the normal single-beam cast.

70. ✅ **Pact Boon mechanics — Tome & Blade.** (done + verified locally 2026-07-23) Turn `pactBoon` from a bare label into structured hooks, cleaning up the previous boon's granted content if it's switched.
    - **Pact of the Tome:** a cantrip picker (any class, reuse `SpellPickerModal`'s cantrip section) to choose **3 cantrips** → added to `sheet.spells` (level 0, tome-sourced tag) so they ride the always-castable cantrip behavior (#64); note Book of Ancient Secrets ritual option if that invocation is known.
    - **Pact of the Blade:** a **"Create pact weapon"** button that seeds an `attacks[]` row (name "Pact Weapon", ability selectable STR/DEX/CHA-if-Hexblade-house-rule but default STR/DEX, `magicBonus` editable, flagged magical) using the rollable-attacks block (#43). When **Thirsting Blade** is known show an "attacks twice" note; when **Lifedrinker** is known add "+CHA necrotic on hit" as a damage annotation on that attack.

71. ✅ **General familiar panel (all classes), extended by Pact of the Chain.** (done + verified locally 2026-07-23) Built as a *class-agnostic* `FamiliarPanel` (modeled on `WildShapePanel`) rather than a Warlock-only block, per a design change: the panel appears for **anyone who knows the find familiar spell** (`sheet.spells` has `srdId === "find-familiar"` — wizard by default, or any class via Ritual Caster / Magic Initiate) **or** who has `pactBoon === "chain"`. New `sheet.familiar` sub-object (`{ monsterId, hpCurrent, hpMax, dismissed }`). Standard find familiar forms (15 CR-0/tiny forms: bat/cat/crab/frog/hawk/lizard/octopus/owl/poisonous-snake/quipper/rat/raven/sea-horse/spider/weasel, sourced in `shared/src/systems/srd-familiars.ts` from `SRD_MONSTERS`); a "show all monsters" toggle opens the full SRD list + approved custom monsters. Summon seeds HP from the stat block, tracks familiar HP, and rolls the form's real attacks via `AttackRollControl` (Multiattack/non-attack actions filtered out). Dismiss/resummon toggle (retains form + HP) rather than consuming a use; "choose different form" resets. **Pact of the Chain modifies the shared panel**: appends the four special forms **imp / pseudodragon / quasit / sprite** and surfaces the telepathy/shared-senses note when **Voice of the Chain Master** is known. Verified live: wizard-with-find-familiar shows 15 forms, chain warlock shows 19 (+telepathy note), plain fighter shows nothing; summon/dismiss/resummon/attack-roll all work and persist through autosave.

72. ✅ **Warlock level-up & creation wiring (polish).** (done + verified locally 2026-07-23) Folded pact content into the existing flows:
    - **Level Up prompts.** New `invocationLevelUpPending`/`pactBoonLevelUpPending` state, computed in `levelUp()` alongside the existing ASI/wizard-spellbook pending flags: an inline "New Eldritch Invocation available" block (with a "Choose invocation" button reusing the existing `InvocationPickerModal`/`addInvocation`) appears whenever `expectedInvocationsKnown` increases between the old and new level (it only ever increases by exactly 1 per level-up, so no count-loop needed); an inline "Pact Boon unlocked" block with its own select appears at level 3 if no boon is chosen yet. Both clear automatically once resolved (`addInvocation` and `changePactBoon` reset the respective flag) and both reminders are also appended to the level-up summary message. Mystic Arcanum tiers (11/13/15/17) needed no changes — already handled by the existing unlock-tier UI.
    - **Creation wizard.** New `isWarlockClass` branch mirroring the existing Wizard-only `spellbook` step: a `WizardSpellbookPicker` (generalized with a `classId` prop, default `"wizard"`, so it now also filters to the Warlock spell list) requires picking exactly `expectedCantripsKnown("Warlock", level)` cantrips (2 at level 1, correctly recomputed for any starting level); `spellSlots` are auto-seeded from `expectedSlots("Warlock", level)` (fixed by level, no player choice, unlike which cantrips are known); a Pact Boon `<select>` appears in the same step whenever the starting level is ≥ 3.
    - **Rest handling.** Verified, no code changes needed: short rest already restores Pact Magic slots for `casterType === "pact"` (#54); the only "once per long rest" usage flag that exists on the sheet is `mysticArcanum[].used`, already reset by `longRest()`. At-will invocation spells (`atWill: true`) have no usage counter by design (always castable, matching RAW) — nothing to reset.
    - **Verified live**: created a level-3 Warlock through the wizard (2 cantrips restricted to the real Warlock list, 1st-level slots ×2 seeded, Pact of the Blade chosen) — confirmed via the raw API; leveled 3→4 (no prompts, correct) then 4→5 (invocation prompt fired with the right "2 → 3" copy, picking one via the reused modal cleared the prompt and persisted); separately created a level-2 Warlock with no boon, leveled to 3, confirmed the Pact Boon prompt fired and picking a boon via its own select cleared the prompt and persisted correctly.

**Future extension (not scheduled): custom patrons & custom invocations.** A `"patron"` / `"invocation"` custom-content type (mirroring #59–61) so homebrew Otherworldly Patrons and bespoke invocations with structured `grants` flow through the same pipeline. Out of scope for 68–72.

## Theme: equipped gear — computed AC (armor & shield) + attunement

Goal: make equipping gear *mean* something. Today AC is a flat manual number (`sheet.ac`) plus each equipped item's flat `acBonus` (`effectiveAC`, `dnd5e.ts`), and picking SRD armor only copies its weight + drops the AC formula into the item's *notes text* — it never touches AC. So a suit of plate and a shield are mechanically identical to the AC math, and the player hand-types their AC. Fix: model worn armor + shield structurally and compute AC by the real 5e formula, and add an attunement toggle with the 3-item cap. Both changes touch the same two places — the inventory item schema and the item-bonus computation pipeline (`effectiveAC` / `equippedAbilityBonus`) — so build them together. All sheet-JSON; no DB migration. Reuses `SRD_ARMOR` (`baseAC/dexBonus/maxDexBonus/stealthDisadvantage/category`, already present) and the custom-item armor fields (same shape, already in `customItemDataSchema`).

73. ✅ **Equipped armor & shield drive computed AC.** (done + verified locally 2026-07-22) Give inventory items a structured armor payload and compute AC properly instead of flat-adding.
    - **Schema:** add optional `armor?: { baseAC: number; addDex: boolean; maxDex?: number; category: "light" | "medium" | "heavy" | "shield"; stealthDisadvantage: boolean }` to `inventoryItemSchema`. The SRD-armor picker (`handleNameChange` in `Dnd5eSheet.tsx`, which today only sets weight + notes) and custom armor items populate it from `SRD_ARMOR` / `CustomItemData` instead of just writing the formula string.
    - **Rework `effectiveAC`:** find the single equipped **body armor** (category light/medium/heavy) → `base + (addDex ? min(dexMod, maxDex ?? ∞) : 0)`; if none equipped, unarmored `10 + dexMod`. Then **+ equipped shield** (category shield → +2, from its `baseAC`), + other equipped items' flat `acBonus`, + feat `acBonus`. Show the result with a breakdown ("Chain Shirt 13 + Dex +2 + Shield +2 = 17").
    - **Manual override:** repurpose the existing `sheet.ac` box as an **optional override** ("blank/0 = auto-compute from equipped armor") so Monk/Barbarian unarmored defense, mage armor (13+Dex), and natural armor still work without modeling every class feature. (Chosen approach: auto-from-armor + override, not fully-automatic AC — full auto would need class/feature awareness, a bigger surface.)
    - **Free wins:** flag **Stealth disadvantage** on the Stealth skill row when equipped body armor has `stealthDisadvantage`; soft-warn if two body armors or two shields are equipped at once (only one of each counts).

74. ✅ **Attunement toggle + 3-item cap.** (done + verified locally 2026-07-22) Add attunement tracking to items, gated into the same bonus pipeline as #73.
    - **Schema:** add `attuned: z.boolean().default(false)` and `requiresAttunement: z.boolean().default(false)` to `inventoryItemSchema`. `requiresAttunement` is a **manual per-item flag** — the SRD magic-item data is names/category/rarity only (`SrdMagicItem` has no attunement field), so it can't be auto-derived; custom items may set it in their own data.
    - **UI:** an **Attuned** checkbox beside the existing **Equipped** checkbox; a **requires attunement** checkbox in the item's bonus area; and an **"Attuned: X / 3"** counter (near the AC/inventory header) that turns red when over 3 (standard 5e cap).
    - **Bonus gating:** introduce `itemBonusesActive(item) = item.equipped && (!item.requiresAttunement || item.attuned)` and use it in `effectiveAC`, `equippedAbilityBonus`, and anywhere equipped-item bonuses apply today — so a magic item that requires attunement only grants its AC/ability bonuses once actually attuned (and equipped). Items that don't require attunement are unaffected (behave exactly as today).

## Theme: feat builder grants parity

Goal: the feat builder (#49, `customFeatDataSchema`) only expresses flat numeric bonuses (per-ability ASI + acBonus/attackBonus/damageBonus/spellDCBonus/spellAttackBonus) + a description. Audited against the 70 feats on dnd5e.wikidot.com: **~33 are partially modeled** (only their "+1 ability" half is captured; everything else is description text) and **~37 model nothing structurally**. The two highest-value missing capabilities — **granted spells/cantrips** and **proficiency grants** — are the *same two fields* already speced for Warlock invocations in #68, so build them once on the shared effect schema and apply to both. Depends on #68's schema work.

75. ✅ **Extend the feat builder (and features) with skill/proficiency & spell grants.** (done + verified locally 2026-07-23) Reuse the #68 shared effect payload so a custom feat can grant real mechanics, not just flat bonuses:
    - **Skill/save/tool proficiencies** — the `skillProficiencies[]` from #68 (already wired into the skill display + `skillBonus`), plus optionally `saveProficiencies[]` (Resilient) and freeform tool/weapon/armor proficiency text appended to `proficienciesText`. Unlocks Skilled, Skill Expert, Weapon Master, Resilient, the Armored feats, Linguist, etc.
    - **Granted spells/cantrips** — the `grantedSpells[]` from #68 (pushed into `sheet.spells`, at-will ones flagged `atWill` so they skip slot consumption per #65). Unlocks Magic Initiate, Fey Touched, Shadow Touched, Telekinetic, Telepathic, Ritual Caster, Spell Sniper, Aberrant Dragonmark, Artificer Initiate, Eldritch Adept.
    - **Manager form:** add the skill-proficiency checkboxes + granted-spell picker to the feat sub-editor (mirroring the invocation/background authoring UIs). The FeatPickerModal (#49) applies/reverts the grants on pick/remove, same as invocations (#68).
    - **Out of scope (description-only, as today):** HP/speed/initiative/passive-score/resistance bonuses and advantage/reaction/conditional riders (Tough, Mobile, Alert, Lucky, Sentinel, Great Weapon Master, Sharpshooter, …) — these need per-effect fields with little reuse and stay narrative text. A later item could add `hpPerLevel` / `speedBonus` / `initiativeBonus` scalar fields if demand shows up.

## Theme: build version number

Goal: surface which build is running so "what's actually deployed?" is answerable at a glance instead of curling GHCR digests and bundle hashes by hand (as the last few deploy verifications required). Today there's no root `package.json` version, the three workspace `version` fields have drifted (`shared`/`backend` `0.0.1`, `frontend` `0.0.0`) and are never bumped, nothing is shown in the UI, and `/api/health` returns only `{status, db}`. Version identity = **semver + short commit SHA** (e.g. `v0.1.0 · 09dd814`) — semver for humans, SHA for exactness. CI already computes the short SHA for the image tag (`type=sha,format=short`); reuse it.

76. ✅ **Add a build version number (semver + commit SHA), surfaced in the UI and `/api/health`.** (done + verified locally 2026-07-23)
    - **Source of truth:** add a `version` to the **root `package.json`** as the one semver (bump manually on releases); stop relying on the drifted per-workspace versions. The commit SHA comes from the build, not a file.
    - **Build-time injection:** add `ARG APP_VERSION` / `ARG GIT_SHA` to the `Dockerfile`; map them to `VITE_APP_VERSION` / `VITE_GIT_SHA` env for the frontend build stage (Vite inlines `import.meta.env.VITE_*`) and to runtime `ENV` for the backend stage. The CI workflow (`docker-image.yml`) passes `build-args: |\n  GIT_SHA=${{ github.sha }}\n  APP_VERSION=<root package.json version>`. Both default to `"dev"` when unset so local `npm run dev` and `docker build` without args still work.
    - **Backend:** return `version` and `commit` (short SHA) alongside `status`/`db` in `/api/health` — so a plain `curl https://ttrpg.gliffy.tv/api/health` confirms the deployed build with no browser.
    - **Frontend:** a small muted **footer** at the bottom of the app shell (`App.tsx`) reading `import.meta.env.VITE_APP_VERSION` + `VITE_GIT_SHA` — e.g. `RPG Companion v0.1.0 · 09dd814`. Shows `dev` locally.
    - **Verify:** local build shows `dev`; after a push+deploy, the footer and `/api/health` both show the pushed commit's short SHA matching the GHCR `sha-…` tag.

## Theme: public character share links

Goal: let a player hand someone a read-only view of a character without that person logging in — today every character endpoint sits behind `charactersRouter.use(requireAuth)` and `GET /:id` further requires owner-or-DM, so there is *no* unauthenticated path to a sheet. Add an opt-in, revocable **per-character share token**: a long random URL-safe string that grants an anonymous, read-only, privacy-redacted view of one character. Split into backend (token + public endpoints) then frontend (public page + share button).

77. ✅ **Backend: per-character share token + unauthenticated read endpoint.** (done + verified locally 2026-07-23)
    - **Schema:** add a nullable, unique `shareToken text("share_token")` column to the `characters` table (migration is a plain `ALTER TABLE ADD COLUMN` — **inspect the generated SQL**, drizzle-kit has produced buggy table-recreates before; hand-fix like earlier migrations if so). Null = not shared.
    - **Token:** minted on demand as a URL-safe random string (`crypto.randomBytes(24).toString("base64url")`), unguessable and revocable.
    - **Authed management endpoints** (stay on `charactersRouter`, owner/DM): `POST /:id/share` → mint the token if absent, return it; `DELETE /:id/share` → null it (revoke). Idempotent mint (re-POST returns the existing token).
    - **Public endpoints — must NOT be behind `requireAuth`, and MUST be read-only:** register a *separate* router `app.use("/api/shared/characters", publicSharedRouter)` mounted in `index.ts` outside the authed characters router. It exposes **only `GET`** handlers — no POST/PATCH/PUT/DELETE, ever. `GET /api/shared/characters/:token` → look up by `shareToken`, 404 on miss/revoked, return a **read-only, redacted** character: always strip `sheetData.privateNotes` (reuse the `redactPrivateNotesIfNotOwner` logic, treating anonymous as non-owner) and the freeform owner `notes` field; keep stats/spells/inventory/portrait ref. `GET /api/shared/characters/:token/portrait` → serve the portrait, also unauthenticated.
    - **No-write guarantee (the security boundary — this is where "anonymous can't change anything" is actually enforced, not in the UI):** the share token is a **lookup key, never an auth credential** — it grants zero write capability. Every mutation endpoint (`PATCH/DELETE /:id`, `/attach`, `/detach`, portrait upload, rolls, notes, everything) stays on the authed routers behind `requireAuth` + `requireCharacterOwnerOrDM`, so an anonymous request to any of them 401s regardless of whether the attacker knows the token. The public router literally has no code path that writes to the DB or filesystem. Add a test asserting a crafted `PATCH /api/characters/:id` (and `POST /api/rolls`, `POST /:id/share`) with no session is rejected 401 even when the character is shared.
    - **Safety:** token length makes enumeration infeasible; revocation is immediate (next request 404s).

78. ✅ **Frontend: public read-only share page + Share button.** (done + verified locally 2026-07-23)
    - **Pre-auth route:** the app has no router and hard-gates on `if (!user) return <AuthPage/>` (`App.tsx`). At the very top of `App` (before the auth gate and even the `loading` check), detect a share URL from `window.location.pathname` — e.g. `/c/:token` — and if present render a standalone `SharedCharacterPage` that bypasses auth entirely. Add a matching Caddy/SPA fallback so `/c/*` serves the app.
    - **`SharedCharacterPage`:** fetch `GET /api/shared/characters/:token`; on 404 show a "link expired or revoked" message; otherwise render the per-system sheet component (`Dnd5eSheet`/`Pf2eSheet`/`GenericSheet`) in **`readOnly`** mode. Extend `readOnly` (or add a `publicView` prop) to also suppress the still-interactive/authed bits the memorial view leaves on — the embedded `DiceRoller`, click-to-roll skill/save handlers (they call the authed `/api/rolls`), the Share button, portrait upload — so the public view is purely presentational. Portrait `src` points at the public `/portrait` endpoint.
    - **Share button:** on the owner's/DM's sheet (hidden in `readOnly`), a **Share** control that calls `POST /:id/share`, shows the resulting `https://ttrpg.gliffy.tv/c/<token>` with copy-to-clipboard, and a **Revoke** button (`DELETE /:id/share`) with a "this invalidates the existing link" confirm.
    - **Verify:** mint a link as the owner, open it in a logged-out browser/incognito → sheet renders read-only with no private notes, no dice roller, no edit controls, and the auto-save effect never fires (no `PATCH` in the network tab no matter what the viewer clicks); attempt a hand-crafted `PATCH /api/characters/:id` from that anonymous session → 401; revoke → the link 404s. The frontend read-only is UX/defense-in-depth; the 401 is the real guarantee (see #77).

## Theme: class proficiencies at character creation

79. ✅ **Class-granted proficiencies (saves, armor, weapons, tools, skill choices) in the creation wizard.** (done + verified locally 2026-07-23) Classes grant proficiencies at level 1 that the wizard previously ignored entirely (only background skills were applied). New `shared/src/systems/srd-class-proficiencies.ts` holds each of the 12 SRD classes' `{savingThrows, armor[], weapons[], tools[], skillChoiceCount, skillChoices[]}` (CC-BY-4.0). In the Basics step, once a built-in class is picked, a block shows the fixed grants ("saving throws in X & Y; proficiency with …; tools — applied automatically") plus a **"choose N class skills"** picker; the picker's options exclude any skill the background already grants (RAW: no doubling up). On create: saving throws → `saveProficiencies`, chosen skills merged (deduped) with background skills into `skillProficiencies`, and armor/weapon/tool lines prepended to `proficienciesText`. Both the Basics "Next" and the final "Create" are gated until the class skill choices are complete. Custom/homebrew classes have no data and show no block (guarded, doesn't block progression). Verified live: a Rogue with Acolyte background persisted `saveProficiencies:["dex","int"]`, merged skills `[insight, religion, acrobatics, deception, investigation, stealth]` (Insight correctly excluded from the class picker since Acolyte grants it), and the armor/weapon/tool text; the sheet then showed both saves checked with correct bonuses. Follow-on ideas (not done): apply class proficiencies retroactively on the existing sheet for characters made before this, and a class **tool**-choice picker (a couple of classes grant "choose one" tools, currently shown as descriptive text).

## Theme: weapon attack fixes

80. ✅ **Fix weapon attacks: ability modifier on damage, sensible default ability, visible damage.** (done + verified locally 2026-07-24) The weapon Attacks table computes the *attack roll* correctly (`attackBonus()` = ability mod + proficiency + magic + feat bonuses) but has two bugs and one UX gap, most visible on a finesse weapon like a dagger:
    - **Bug 1 — damage roll drops the ability modifier (the main one).** `AttackRollControl.rollDamage()` ([frontend/src/components/systems/AttackRollControl.tsx](frontend/src/components/systems/AttackRollControl.tsx)) rolls `damageDice + magicBonus`, and the Attacks table ([Dnd5eSheet.tsx](frontend/src/components/systems/Dnd5eSheet.tsx), the `AttackRollControl` call in the Attacks section) passes only `atk.magicBonus + featBonusTotal(sheet, "damageBonus")` — the **ability modifier is silently missing**. A Rogue's dagger (1d4) with DEX +3 rolls `1d4` instead of the correct `1d4+3`. Fix: pass `abilityModifier(effectiveAbilityScore(sheet, atk.ability)) + atk.magicBonus + featBonusTotal(sheet, "damageBonus")` as the damage bonus. Scope is *only* the weapon Attacks table — Wild Shape / Familiar monster attacks pass `magicBonus={0}` and already bake the modifier into their damage dice (e.g. `1d4+2`), so they must stay untouched.
    - **Bug 2 — finesse/ranged weapons default to STR.** "Add to Attacks" ([Dnd5eSheet.tsx](frontend/src/components/systems/Dnd5eSheet.tsx), the weapon inventory row's button) hardcodes `ability: "str"`, so a dagger shows the STR-based attack bonus until the player manually flips the dropdown to DEX — which reads as "the attack bonus is wrong." Fix: derive the ability from the weapon's `properties`/`range`: **Finesse → the higher of STR/DEX**, **Ranged → DEX**, otherwise **STR** (custom weapons: use their properties if present, else STR). The blank "Add attack" button keeps STR (no weapon context).
    - **UX — damage bonus is invisible until you roll.** The row shows "Bonus: +X" (attack roll) but the damage modifier only appears after Roll → Hit. Add a small live readout (e.g. `Damage: 1d4 +3 piercing`) next to the dice inputs so the modifier is visible and the fix is self-evident.
    - **Out of scope (existing simplifications, noted not fixed):** the attack bonus always adds proficiency ("always proficient" — the app doesn't structurally track per-weapon proficiency); two-weapon-fighting off-hand (no ability mod to damage). Neither is the dagger bug.
    - **Verify (done):** DEX 16 Rogue, add a dagger via "Add to Attacks" → defaults to DEX, "Bonus: +5" (DEX+3, prof+2), live readout "Damage: 1d4 +3 piercing", Roll → Hit rolled `1d20+5` then `1d4+3` exactly. STR 8 Barbarian + longsword → correctly defaults to STR (not DEX, not finesse), "Bonus: +1", readout "Damage: 1d8 -1 slashing" (negative-mod case renders correctly).

## Theme: usable martial resources

81. ✅ **Usable/limited-use martial features (Rage, Action Surge, Indomitable, Ki) with rest refresh.** (done + verified locally 2026-07-24) Today the **Martial features** panel ([Dnd5eSheet.tsx](frontend/src/components/systems/Dnd5eSheet.tsx), rendered from `martialFeatureLines()` in [class-progression.ts](shared/src/systems/class-progression.ts)) is pure derived *display text* — nothing is trackable/consumable. Make the limited-use pools clickable so e.g. a Barbarian's rages decrement on use and refill on a long rest. The counts already live in `MartialLevelEntry` (`rageCount`, `actionSurges`, `indomitableUses`, `kiPoints`).
    - **Pools that get a counter + Use button** (with their reset rule): **Rage** → long rest; **Action Surge** → short or long rest; **Indomitable** → long rest; **Ki Points** → short or long rest. Everything else in the panel (Extra Attack, Sneak Attack, Martial Arts, Brutal Critical, Unarmored Movement, Aura Range, Favored Enemies/Terrain) stays passive display text.
    - **Schema:** add `martialUsed: Record<string, number>` to the 5e sheet (e.g. `{ rage: 2, ki: 3 }`) — store *uses spent*, not available, so **available = derivedMax − used** (floored at 0). This sidesteps the "max changes on level-up" problem: a fresh/leveled character is automatically full, and a rest just zeroes the relevant keys. Keys: `rage`, `actionSurge`, `indomitable`, `ki`.
    - **Shared helper:** new `martialResourcePools(martial)` → `[{key, label, max, resetOn}]` for the four pool types; refactor `martialFeatureLines()` to return only the *passive* lines so pools aren't double-rendered.
    - **Sheet UI:** render pools as counters with buttons, e.g. `Rage: 2 / 3 (+2 dmg) [Use] [Reset]`, `Ki Points: 4 / 5 [Use] [Reset]`. **Use** decrements available (disabled at 0 = increments `martialUsed[key]`); **Reset** zeroes that key manually. Passive lines unchanged.
    - **Rest wiring:** `longRest()` clears **all** martial pools (`martialUsed: {}`); `shortRest()` clears **only** Action Surge + Ki (RAW). Both functions already reset spell slots / wild shape / mystic arcanum, so this slots in alongside; mention it in the rest message.
    - **Scope decisions:** reset timing is RAW-accurate (Rage/Indomitable long-rest only; Action Surge/Ki short-or-long); **Ki "Use" = −1 point** (multi-click for costlier abilities — a "spend N" input is a later nicety); a level-20 Barbarian (`rageCount: -1`, unlimited) shows "Unlimited" with no counter; works for **custom classes** too since `effectiveLevelEntry` already surfaces custom martial data (#58). **Out of scope:** Bardic Inspiration and Battle Master superiority dice (not in the martial data model — separate features).
    - **Verify (done):** Barbarian (level 3) → Rage 3/3 → Use twice → 1/3, Reset button correctly disabled at full and enabled once spent, Use correctly disabled at 0/3 (no overspend past max, confirmed via `martialUsed: {rage: 3}` persisted server-side); short rest leaves Rage at 0/3 with no "Martial resources restored" note (Barbarian has no short-reset pools); long rest refills to 3/3, message says "Martial resources restored.", persisted `martialUsed: {}`. Fighter (level 2) → Action Surge 1/1 → Use → 0/1 → short rest refills to 1/1 with the note present (unlike Rage). Monk (level 2) → Ki Points render as a 2/2 counter alongside Martial Arts/Unarmored Movement staying as passive text (no double-render). Level-20 Barbarian → Rage shows "Unlimited (+4 dmg)" with zero buttons, Brutal Critical stays passive text.

## Theme: hardening from 2026-07-24 code review

Bugs, concurrency, and security gaps found in a static review of `main` @ `ca7b01f`. Ordered by severity; #82 is the urgent authz defect.

82. ✅ **Fix cross-campaign shop item modification (Critical).** (done locally 2026-07-24) `updateShopItem` / `deleteShopItem` now resolve the campaign shop then mutate with `WHERE id = ? AND shop_id = ?`, throwing `ShopItemNotFoundError` (404) when the item is not in that shop. Routes catch and return 404.

83. ✅ **Close the first-registration admin race (High).** (done locally 2026-07-24) bcrypt stays outside the critical section; `count(*)` + insert run inside a SQLite transaction so only the true first user becomes admin. Unique-username races map back to `UsernameTakenError`.

84. ✅ **Prevent lost sheet updates and incomplete shop transfers (High).** (done locally 2026-07-24)
    - **Character sheets:** `updateCharacter` accepts optional `expectedUpdatedAt`; mismatch → `CharacterConflictError` / HTTP 409. Shared schema + 5e/PF2e/generic sheets send it; 5e autosave shows a reload message on conflict.
    - **Shop buy/sell:** buy/sell run character sheet + stock updates inside `db.transaction` with fresh reads.

85. ✅ **Enforce a single active encounter (Medium).** (done locally 2026-07-24) `startEncounter` / `startPersonalEncounter` deactivate-then-insert inside a transaction. (DB partial unique index still optional follow-on.)

86. ✅ **Clamp roll-history pagination (Medium).** (done locally 2026-07-24) Shared `parseLimit()` rejects ≤0 / non-finite and caps at 200; used by personal and campaign roll list routes. Covered by `pagination.test.ts`.

87. ✅ **Keep initiative turn on the same combatant when order changes (Medium).** (done locally 2026-07-24) Add/update/remove combatant remaps `currentTurnIndex` to the previous current combatant's id after re-sort (falls back to a clamped index if that combatant was removed).

88. ✅ **Rate-limit auth and invite joins (Medium).** (done locally 2026-07-24) In-memory sliding-window limiter on register (per IP), login (per IP + per username), and campaign join (per IP).

89. ✅ **Ops / maintainability follow-ups (Lower).** (done locally 2026-07-24; integration tests still open as #90)
    - ✅ Prune expired SQLite sessions hourly on read (+ delete expired row on get miss).
    - ✅ Portrait uploads validated by magic bytes (`detectImageMime`); client MIME is no longer trusted for storage type. Unit tests added.
    - ✅ `/api/health` returns a generic `"database unavailable"` instead of raw DB error strings.
    - ✅ Backend `npm test` harness (`tsx --test`) with pagination + portrait unit tests.
    - ✅ Lazy-load system sheets on `CharacterSheetPage` — initial JS chunk ~413 KB (was ~1.28 MB monolithic); SRD data still a large async chunk.
    - ✅ Sheet entity ids use `crypto.randomUUID()` / shared `newEntityId()` instead of `Date.now()`.

90. ✅ **Integration / regression tests.** (done locally 2026-07-24) Added `resetDbForTests` + temp-DB harness and `hardening.integration.test.ts` covering: #82 shop scoping, #83 first-admin race, #84 sheet 409 + shop buy transaction, #85 single active encounter, #77 share-token anonymous GET + unauthenticated PATCH 401. Run via `npm test -w backend`. Full breakup of `Dnd5eSheet.tsx` remains a follow-on (partially helped by `CollapsibleSection` in #92).

## Theme: traditional sheet view

Goal: offer a dense, paper-like **view** of a D&D 5e character that reads like a classic sheet, without replacing the existing editable form. Editing stays in `Dnd5eSheet`; the traditional view is presentational only, plus browser print/PDF.

91. ✅ **Traditional 5e character sheet view + print.** (done locally 2026-07-24) View-only alternate layout toggled from the character page.
    - **Toggle:** on the authenticated 5e character page (`CharacterSheetPage`), **Edit** | **Sheet**. Persist choice in `sessionStorage` so refresh keeps the mode. PF2e/generic keep the existing editor only.
    - **Component:** new presentational `TraditionalDnd5eSheet` (not a restyle of the editor) fed by the same `Character` / `Dnd5eSheetData`. No autosave, no dice API calls, no inputs that mutate.
    - **Layout (CSS Grid, approximates a classic 5e sheet):**
      - Header: portrait, name, class/level, race/subrace, background, alignment, proficiency bonus
      - Left: ability scores + modifiers, saving throws (proficiency marks)
      - Center: combat (AC + breakdown, initiative, speed, HP, hit dice), attacks table, conditions
      - Right: skills (proficiency marks + bonuses), passive Perception/Investigation/Insight, proficiencies & languages
      - Below: spellcasting summary (ability, DC, attack, slots, prepared/known list), feats & features, inventory/currency/weight, personality, freeform notes; **private notes only when the viewer is the owner** (same redaction rule as elsewhere)
    - **Math:** reuse shared helpers (`effectiveAbilityScore`, `saveBonus`, `skillBonus`, `effectiveAC`, `attackBonus`, `spellSaveDC`, etc.) so the Sheet view stays in sync with the editor.
    - **Print:** **Print** button on Sheet view calls `window.print()`; `@media print` hides app chrome (header/footer), Back/Edit/Sheet controls, and any non-sheet UI; page-break hints for long spell/inventory blocks. Browser "Save as PDF" is the export path — no PDF library.
    - **Out of scope:** editable traditional layout; PF2e/generic traditional views; dedicated PDF generation; new URL routing (in-page toggle only); wiring into the public share page (can reuse the component later).
    - **Verify:** open a 5e character → Sheet shows dense layout with correct AC/skills/saves vs Edit; toggle persists across refresh; Print preview hides chrome and is readable; private notes absent when viewing another player's sheet as DM.

## Theme: collapsible edit-sheet sections

Goal: declutter the Edit 5e sheet by collapsing big blocks that do not matter for the character (e.g. Spellcasting on a pure martial), while always leaving a one-line **Show** control so nothing is unreachable. Traditional Sheet view (#91) is unchanged.

92. ✅ **Collapsible Edit-sheet sections with smart defaults.** (done locally 2026-07-24) On [`Dnd5eSheet.tsx`](frontend/src/components/systems/Dnd5eSheet.tsx) only (not Traditional/PF2e/generic):
    - **UX:** each target section gets a header with **Show** / **Hide**. Collapsed = one-line bar (title + short reason/count, e.g. "Spellcasting — not used · Show"). Expanded = existing full content.
    - **Smart default (A):** start **collapsed when irrelevant**; start **expanded when relevant**. Manual expand/collapse overrides and is remembered per character in `sessionStorage` (e.g. `rpg-companion:sheet-sections:{characterId}`). If content becomes relevant mid-session (add a spell/feat), auto-expand that section even if previously collapsed.
    - **Sections:**
      - **Spellcasting** — irrelevant when `casterTypeForClass(class) === "none"` AND no spells AND no spellcasting ability (Eldritch Knight / Arcane Trickster / Magic Initiate with ability or spells → expanded).
      - **Feats** — collapsed when `feats.length === 0`.
      - **Features & traits** — collapsed when `features.length === 0` and `featuresText` empty.
      - **Personality & notes** — collapsed when personality, private notes, and owner notes are all empty.
      - **Inventory** — collapsible for declutter but **default expanded** (opt-in hide only).
    - **Already gated (no change required):** Martial features, Wild Shape, Familiar, Pact Magic keep their existing show-when-relevant behavior.
    - **Implementation sketch:** small `CollapsibleSection` helper (`id`, `title`, `defaultCollapsed`, `forceExpanded`, `summary`, children); relevance helpers using existing `casterTypeForClass` from [`class-progression.ts`](shared/src/systems/class-progression.ts); wrap the five blocks without moving their inner logic. Same rules in `readOnly` memorial view.
    - **Out of scope:** Traditional view collapse; PF2e/generic; server-persisted prefs; removing sections entirely (always recoverable via Show).
    - **Verify:** Fighter with no spells sees Spellcasting collapsed with Show; expanding sticks across refresh; adding a spell or setting spellcasting ability auto-expands; Wizard sees Spellcasting expanded by default; Hide on Inventory works but defaults open.

## Theme: code review findings 2026-07-24 (round 2)

Findings from a high-effort multi-angle code review of `4df2a73..HEAD` (the Warlock/weapon/martial
work plus the hardening commit `bdf111e`). All ten below were **CONFIRMED** by a verification pass —
each cites the code path that makes it reachable. Several are regressions introduced by the
hardening/UX items #84, #88, and #92; two are defects in the Pact Boon (#70) and class-proficiency
(#79) work. Ordered most severe first.

93. ✅ **Campaign character list leaks every player's `privateNotes` (security — fix first).** (done + verified locally 2026-07-27) `GET /api/campaigns/:id/characters` ([campaigns.routes.ts](backend/src/routes/campaigns.routes.ts), the `requireCampaignMember` route) returns `listCharactersForCampaign()` straight from [characters.service.ts](backend/src/services/characters.service.ts), which maps rows through `toCharacter` — `sheetData: JSON.parse(row.sheetData)` and `notes: row.notes` with **no redaction and no owner check**. Every *other* read path redacts: `redactPrivateNotesIfNotOwner` on `GET`/`PATCH /api/characters/:id`, and `redactForPublicView` on the share route. The schema comment on `privateNotes` ([dnd5e.ts](shared/src/systems/dnd5e.ts)) states "never sent to or writable by a non-owner" — violated literally.
    - **Reachability is not theoretical:** `listCampaignCharacters` is called by `CharactersSection` and `ShopSection`, both rendered for every logged-in member on the campaign dashboard, so every member's browser already receives every other member's full sheet. The client-side owner filter in `ShopSection` is cosmetic.
    - **Double severity:** a peer player calling `GET /api/characters/:id` gets a flat 403 (owner-or-DM only), so this route hands peers data the intended path denies — and hands the DM the one field the DM is explicitly denied.
    - **Fix (done):** moved `redactPrivateNotesIfNotOwner` from `characters.routes.ts` into `characters.service.ts` (exported) and added a sibling `redactForCampaignMember(character, requesterId, requesterRole)` alongside it — same `privateNotes` owner/admin-only rule, plus `notes` now also blanked for a requester who is neither the owner, the campaign's DM, nor a global admin. `campaigns.routes.ts`'s list route now maps every character through it using `req.campaignMembership!.role`. New regression test in `hardening.integration.test.ts` (`campaign character list redaction (#93)`) logs in via real HTTP sessions as owner/DM/peer and asserts each sees exactly what they should — all 15 backend tests pass.

94. ✅ **Modals rendered inside collapsible sections are unreachable when collapsed (regression from #92).** (done + verified locally 2026-07-27) [`CollapsibleSection`](frontend/src/components/systems/CollapsibleSection.tsx) renders `{expanded ? children : null}` — it **unmounts** children rather than hiding them with CSS. Two modals were left inside sections while their triggers live outside, so setting the open-flag mounts nothing.
    - **94a — `FeatPickerModal` (worse; needs no user action).** Rendered inside the Feats section, whose relevance is `featsRelevant = sheet.feats.length > 0` — so a character who has never taken a feat defaults to **collapsed**. That is exactly the state at a first ASI. `applyAsi()`'s feat branch sets `featPickerContext="asi"`, `setAsiPending(false)`, and `return`s early (skipping the ability-score mutation), so the ASI panel unmounts, the modal never mounts, no `levelUpMessage` fires, and the ASI is silently consumed with **no feat and no ability increase**. The relevance escape hatch (`!relevant → relevant` clears the override) can't help: `featsRelevant` only becomes true once a feat is added, which is what the unmounted modal was for.
    - **94b — `PrepareSpellsModal`.** Rendered inside the Spellcasting section. `longRest()` (triggered from the always-mounted Rest block) ends with `setPrepareSpellsOpen(true)` for prepared casters. A Cleric who clicked "Hide" on Spellcasting (persisted in `sessionStorage` under `rpg-companion:sheet-sections:<id>`) gets no prompt and silently keeps yesterday's prepared list, while `restMessage` still reports success. The flag is never reset, so the modal later ambushes them when they click "Show" for an unrelated reason.
    - **Fix (done):** hoisted both modals out of their `CollapsibleSection` to render immediately after it closes; their in-section triggers ("Add spells" button, "Add feat" button) stayed where they are. Audited the rest of the sheet for the same class of bug — the other modals inside sections (`SpellPickerModal` for "Add spells", the tome-cantrip picker, `InvocationPickerModal`) all have their trigger button in the same scope as the modal, so they can't go unreachable this way; no other instances found.
    - **Verify (done):** Fighter, level 3 → 4, no feats yet (Feats section defaults collapsed, "— none"/"Show") → "Take a feat instead" → Confirm → `FeatPickerModal` mounts and opens; picked Grappler, persisted (`sheetData.feats: ["Grappler"]`), and the Feats section auto-expanded once relevant. Cleric with Spellcasting hidden ("Hide" clicked) → Long rest → `PrepareSpellsModal` mounts and opens with the full class spell list, where before the fix nothing would have appeared.

95. ✅ **Portrait upload poisons optimistic concurrency — every later save 409s (regression from #84).** (done + verified locally 2026-07-27) `setCharacterPortrait` ([characters.service.ts](backend/src/services/characters.service.ts)) bumps `characters.updatedAt`, but the route ([characters.routes.ts](backend/src/routes/characters.routes.ts)) responds `{ ok: true }` with no character payload, and [`CharacterPortrait.tsx`](frontend/src/components/CharacterPortrait.tsx) only bumps a local `version` counter — it has no `onSaved` prop, so the parent's `character` state never refreshes. `Dnd5eSheet` re-pins `updatedAtRef.current = character.updatedAt` unconditionally on every render, so the stale token is continuously re-asserted.
    - **Failure:** owner opens their sheet (T0), uploads a portrait (server now T1), edits any field → `persist()` sends `expectedUpdatedAt: T0` → the `WHERE` matches no row → `CharacterConflictError` → 409 "Sheet changed elsewhere — reload the page to continue editing". Every subsequent edit repeats it and is discarded, until a manual reload. **Single user, single tab, no concurrent writer.**
    - `reactivate()` sends `expectedUpdatedAt: character.updatedAt` (the prop, not the ref) and is poisoned the same way.
    - **Fix (done):** the portrait route now fetches and returns the redacted character after `setCharacterPortrait`; `uploadPortrait()` (frontend API) returns it instead of `void`; `CharacterPortrait` gained an `onSaved?` prop called with the fresh character; `Dnd5eSheet` wires its existing `onSaved` prop straight through, so the same propagation path every other mutation uses now also covers portrait uploads — fixing both `persist()` (ref-based) and `reactivate()` (prop-based), since both ultimately read from the same `character` state the parent page now refreshes.
    - **Verify (done):** uploaded a portrait via a real `<input type=file>` change event (not a raw fetch) on a live sheet, confirmed the POST response now carries the full character with a bumped `updatedAt`; edited the sheet twice more afterward and both autosaves showed "All changes saved" with `updatedAt` advancing each time — no 409 (the character's `name` field, locked from owner edits per #36, correctly reverted-not-rejected on one of those saves, an unrelated pre-existing behavior that also confirms the PATCH itself succeeded).

96. ✅ **Pact Boon / Book of Shadows data loss (two bugs in #70, no confirmation, autosaved).** (done + verified locally 2026-07-27)
    - **96a — the main spell picker deletes tome cantrips.** Book of Shadows cantrips live in `sheet.spells` distinguished only by the `TOME_CANTRIP_PREFIX` id. `SpellPickerModal` derives its checkboxes from `srdId` only and the main picker passes the full `sheet.spells`, so a tome cantrip renders **already-checked** in "Add spells". Un-checking it runs `sheet.spells.filter((s) => s.srdId !== spell.id)` — deleting the tome entry, dropping the counter to 2/3 with no feedback. If the player also holds that spell normally, one click wipes **both**. Conversely the pre-checked box means that cantrip can never be added as a normal spell. The tome picker's own remove branch already scopes with `s.id.startsWith(TOME_CANTRIP_PREFIX)` and `removeTomeCantrip` filters by unique `id` — **this is the one site missing that precision**; fix it to match.
      - **Fix (done):** the main picker's `currentSpells` now excludes tome-tagged entries entirely (so a Book of Shadows cantrip shows unchecked, letting the same cantrip be added as an independent normal copy per RAW — "don't count against the number of spells you know"), and its remove branch now keeps every tome-tagged entry regardless of `srdId` match, only removing a *non*-tome spell with that id.
      - **Verify (done):** Warlock with Tome cantrip "Light" (`tome-cantrip-abc`) → opened "Add spells", confirmed Light showed **unchecked** → checked it → both a tome copy and a new normal copy (`spell-<uuid>`) coexisted, Book of Shadows still 1/3 → unchecked the box again → only the normal copy was removed, tome copy survived untouched.
    - **96b — `changePactBoon` destroys content silently.** It deletes all tome cantrips and the pact weapon attack row on *every* select `onChange`, with no confirm and no undo, and the debounced autosave persists it (~1s; the unmount flush means navigating away doesn't avert it). A single ArrowUp on the focused Pact Boon `<select>` (native selects commit immediately on keyboard nav) discards three hand-picked cantrips. Deliberate use is equally lossy: switch to Blade to read what it grants, switch back, Book of Shadows is empty at 0/3. Note the same file already gates its one *recoverable* destructive action (share-link revoke) behind `confirm()`. **Fix:** confirm prompt before a boon switch that would discard content, or retain the entries and filter them from display while the boon is inactive.
      - **Fix (done):** `changePactBoon` now checks whether the new boon would actually discard the pact weapon and/or Book of Shadows cantrips and, only then, gates the switch behind a `confirm()` naming exactly what's at stake ("...will permanently remove your pact weapon and your Book of Shadows cantrips. Continue?"); cancelling leaves `sheet.pactBoon` untouched so the controlled `<select>` snaps back to its prior value. A no-op switch (nothing to lose) never prompts.
      - **Verify (done):** stubbed `window.confirm` to isolate both paths — **Cancel**: select forced to "blade", confirm returned `false` → boon stayed "tome", cantrip count unchanged (1/3), nothing persisted. **Accept**: same switch, confirm returned `true` → boon became "blade", tome cantrip removed, persisted server-side (`sheetData.spells: []`). **No prompt**: switching "blade" → "chain" with no pact weapon ever created called `confirm` zero times.

97. ✅ **Creation wizard silently grants fewer skill proficiencies than RAW (defect in #79).** (done + verified locally 2026-07-27) `classSkillSel` is reset only on `[charClass]`, but `classSkillOptions` *also* filters out `backgroundGrantSkillIds`. Pick class skills first, then a background that grants one of them: the checkbox disappears (so it can't be unchecked) while the id stays in `classSkillSel`; `classChoicesComplete` still counts it so the counter reads "2/2 selected" with nothing visibly checked and Next/Create stay enabled; then `create()`'s `mergedSkillIds = new Set([...backgroundGrantSkillIds, ...classSkillSel])` dedupes it away.
    - **Reachable with SRD-only content in the form's own top-to-bottom order** (Class field sits above Background): Cleric + check Insight/Religion + choose Acolyte (grants insight+religion) → character saved with **2** skill proficiencies instead of 4, unnoticeable and unfixable short of switching class and back.
    - **Fix (done):** added an effect pruning `classSkillSel` to `classSkillOptions` (dep `[classSkillOptions]`) — a newly-overlapping pick is dropped from the selection the moment it disappears from the option list, not just visually. Bundled **#99c**'s fix in the same pass since it's the same function: `classChoicesComplete` now requires `Math.min(skillChoiceCount, classSkillOptions.length)` picks instead of the raw `skillChoiceCount`, so an over-constrained custom background can no longer deadlock the wizard; the on-screen count/label reflect the clamped number too, with a note when it was reduced.
    - **Verify (done):** reproduced the exact confirmed scenario — Cleric, checked Insight + History (2/2) — then chose Acolyte (grants insight + religion): Insight's checkbox disappeared *and* the counter correctly dropped to "1/2 selected" (not the stale "2/2"), `Next` correctly re-disabled with the gate message. Picked Medicine to reach 2/2, `Next` re-enabled, completed creation — persisted `skillProficiencies: ["insight","religion","history","medicine"]`, all 4 distinct, matching RAW exactly.

98. ✅ **Rate limiter defects (three, all in #88's new middleware).** (done + verified locally 2026-07-27) [`rateLimit.ts`](backend/src/middleware/rateLimit.ts) + [`auth.routes.ts`](backend/src/routes/auth.routes.ts).
    - **98a — targeted account lockout (security).** `loginUserLimit` keys on the **attacker-supplied username**, and the key function runs before schema validation and before authentication. Any unauthenticated client sends 10 wrong-password POSTs for `{"username":"alice"}` and the real Alice gets 429 for the full 15-minute window, from any IP, even with the correct password; usernames are discoverable from campaign member lists, and rotating IPs makes it indefinite. Also: the key lowercases while `findUserByUsername` compares under SQLite's default BINARY collation (no `COLLATE NOCASE`), so `Alice` and `alice` are separately registrable accounts sharing one bucket. **Fix:** key on the requester (IP) for the per-user limiter, or pair a per-username counter with a per-IP one so a third party can't spend the victim's budget; and decide case-sensitivity for usernames deliberately (collation or normalize-on-write).
      - **Fix (done):** the key is now `login-user:${username}:${req.ip}` — scoped to (username, requester IP) rather than username alone, so an attacker can still only spend their own IP's budget against a named victim, not lock them out globally. Dropped the `.toLowerCase()` so the key matches `findUserByUsername`'s case-sensitive comparison exactly, closing the "one bucket throttles multiple case-variant accounts" gap without touching the DB schema/collation.
    - **98b — unbounded memory growth (DoS).** The module-level `buckets` Map is never swept, size-capped, or deleted from — the `filter` prunes timestamps *inside* an entry but never removes the entry, so every key ever seen persists for the process lifetime. Combined with 98a's attacker-controlled key (and `loginSchema` having no `.max()`, so only `express.json()`'s 100kb cap bounds it), fresh random usernames permanently add attacker-sized entries → heap exhaustion → OOM of the single app container. **Fix:** delete entries whose window is empty, plus a periodic sweep or LRU cap.
      - **Fix (done):** added a periodic sweep (`setInterval`, 10 min, `.unref()`'d so it never blocks process exit) that deletes any bucket whose most recent timestamp is older than the largest `windowMs` registered across all limiters — bounding `buckets.size` to "active within the window," not "every key ever seen." Also delete-on-empty instead of `set`-ing an empty array when a bucket's stamps are fully expired at check time.
    - **98c — shared buckets collide across endpoints.** `registerLimit` (max 10), `loginIpLimit` (max 30), and the campaigns-join limiter (max 20) all omit `opts.key`, so all three resolve to bare `req.ip` and share one array; `loginUserLimit` is the only one that namespaces (`login-user:${…}`), showing the intended pattern. A player mistypes an invite code 10 times (inside join's own max of 20) and a housemate then gets 429 "Too many registration attempts" with zero registration attempts. Effective budget for all three becomes the *minimum* max, and behind `trust proxy 1` everyone on an egress IP shares one bucket. **Fix:** prefix the default key per limiter.
      - **Fix (done):** `rateLimit()` now requires a `name` field (TypeScript-enforced — the build itself catches any missed call site) and the default key becomes `${name}:${req.ip}` when no custom `key` is supplied; every existing call site (`register`, `login-ip`, `campaign-join`) got a distinguishing name.
      - **Verify (done):** two new integration tests in `hardening.integration.test.ts`. First, using `X-Forwarded-For` (with `trust proxy` enabled, matching production) to simulate distinct IPs: 10 wrong-password attempts against a real user from one IP correctly 429 on the 11th, then a **correct**-password login for the same username from a **different** IP succeeds (200) — proving the lockout no longer crosses IPs. Second: logged in, exhausted the campaign-join limiter (20 requests, 21st returns 429), then registered a fresh account from the *same* IP — 201, proving an unrelated endpoint's limiter no longer shares a bucket. All 18 backend tests pass (15 prior + 3 new).

99. ✅ **Lower-severity review findings (real, cut from the top-10 report).** (done + verified locally 2026-07-27)
    - **99a — empty shop-item PATCH returns 500.** `updateShopItemSchema` makes every field optional, so `PATCH /api/campaigns/:id/shop/items/:itemId` with body `{}` parses fine and reaches drizzle's `.set({})`, which throws `No values to set` *before* any DB access. The route's catch only handles `ShopItemNotFoundError`, so Express's error handler returns 500 — and it masks the 404 path (an empty PATCH against a nonexistent item 500s before the not-found check runs). Contrast `updateShop`, which builds its update object key-by-key and always seeds `updatedAt` so it can never be empty.
      - **Fix (done):** added `.refine((v) => Object.keys(v).length > 0)` to `updateShopItemSchema` — an empty body is now rejected by the existing `safeParse` → 400 path the route already had, no route change needed.
      - **Verify (done):** integration test — empty `{}` PATCH on a real shop item → 400 (was 500); a real `{quantity: 3}` PATCH on the same item still succeeds → 200 with the updated quantity.
    - **99b — invalid image upload returns 500 instead of 400.** `savePortrait` ([portraits.ts](backend/src/lib/portraits.ts)) now throws a bare `Error` when magic-byte detection fails, but multer's `fileFilter` already accepted the file on its **client-declared** MIME type, so a mislabeled/truncated/0-byte file reaches the throw. The async handler doesn't catch it → generic 500 + `console.error` stack, where the sibling bad-input path returns an actionable 400. Reachable normally (HEIC renamed to `.jpg`, interrupted download).
      - **Fix (done):** wrapped `savePortrait` in try/catch in the route, returning `400 {error: <thrown message>}` on failure — matching the sibling `!req.file` 400 response right above it.
      - **Verify (done):** uploaded a text file declared as `image/png` both via a live browser session (`400 {"error":"Unsupported or invalid image file"}`) and via an integration test — both confirm 400, not 500.
    - **99c — class-skill gate can deadlock the wizard (custom content only).** ✅ **Done** — fixed alongside #97 above (same function): `classChoicesComplete` now clamps to `Math.min(skillChoiceCount, classSkillOptions.length)`.
    - **99d — `TraditionalDnd5eSheet` casts `sheetData` instead of parsing it.** Uses `character.sheetData as Dnd5eSheetData` rather than `dnd5eSheetSchema.parse(...)`, then immediately spreads/iterates `sheet.feats`, `sheet.features`, `sheet.spells`, `sheet.spellSlots`, `sheet.currency`. A row last written before a schema field was added yields `undefined` → TypeError, and there is **no error boundary anywhere in the frontend**, so the page blanks. The sticky view-mode in `sessionStorage` means a user can land in the crashing view without passing through the self-healing edit view. Mitigated by both write paths (`POST`/`PATCH`) normalizing through zod. **Not a new defect class** — `SharedCharacterPage` and `ShopSection` already do the same raw cast, so fix all three (or add an error boundary) rather than just this one.
      - **Fix (done):** all three sites (`TraditionalDnd5eSheet.tsx`, `SharedCharacterPage.tsx`, `ShopSection.tsx`) now call `dnd5eSheetSchema.parse(character.sheetData ?? {})` instead of an `as` cast, matching what `Dnd5eSheet.tsx`'s edit view already does — every field gets its schema `.default()` regardless of how old the stored row is.
      - **Verify (done):** live-tested the Traditional sheet view and the public `/c/:token` share page on a freshly-created character — both rendered correctly with no console errors (one unrelated pre-existing React "missing key prop" warning noted and spun off as a separate follow-up task, not caused by this change).

**Refuted during review (documented so they aren't re-raised):** shop buy/sell reading the shop row *outside* the transaction, and `advanceTurn`'s read-modify-write of `currentTurnIndex`, both look like races but are **not** reachable today — better-sqlite3 executes drizzle statements synchronously and there is no `await` between the read and the write, so no other request handler can interleave, and the deployment is a single app container with no cluster/workers. They become real the moment a second writer process touches `data/app.db` (a replica, a worker, an overlapping rolling restart), so re-reading inside the transaction is worthwhile hardening — just not a present-day bug.

## Theme: richer background & feat authoring

Three related authoring gaps in the custom-content manager, all in the same two forms. #100 is
independent; #102 depends on #101's form work being in place and should land after (or with) the
#94a fix, since it turns the feat picker into a multi-step flow.

100. ✅ **Backgrounds can grant more than one feature, each with real bonuses.** `customBackgroundDataSchema` ([custom-content.ts](shared/src/systems/custom-content.ts)) has a single `feature: { name, description }`, so a background with two distinct features has to cram them into one box.
    - **Schema:** `feature` → `features: [{ id, name, description, ...effectBonuses, skillProficiencies }]` (max 5). Per the decision to give background features the **full effect-bonus row**, reuse the existing `effectBonusesSchema` (already in custom-content.ts, used by `customFeatDataSchema`) rather than a bespoke shape — that makes a background feature structurally identical to a feat's payload.
    - **No DB migration.** The schema already has a `z.preprocess` legacy shim (it upgrades the pre-structured flat `{skillProficiencies, feature, toolProficiencies, equipmentText}` shape). Extend that same shim to map a singular `feature` → `features: [feature]`, so both the legacy flat rows *and* the current structured-with-singular-`feature` rows keep parsing untouched.
    - **Manager form** ([CustomContentManager.tsx](frontend/src/pages/CustomContentManager.tsx)): replace the fixed name/description pair (currently `bgFeatureName`/`bgFeatureDescription`) with a repeatable list + **"Add feature"** and per-row Remove, matching the existing repeatable editors (variants, equipment items). Each row gets the bonus inputs alongside name/description.
    - **Wizard** ([CharacterCreationWizard.tsx](frontend/src/pages/CharacterCreationWizard.tsx)): `backgroundGrants()` currently pushes one entry guarded by `if (data.feature.name)`; loop `data.features` instead, pushing **one sheet entry per feature** so they stay separate on the sheet (the whole point). Sheet side needs **no change** — `effectEntrySchema` already carries these bonus fields, so the wizard simply stops hardcoding zeros.
    - **Also update:** `SrdBackground.feature: string` ([srd-backgrounds.ts](shared/src/systems/srd-backgrounds.ts)) — the synthesized `resolvedBackgroundData` in the wizard maps it into the new shape as a one-element array (only Acolyte exists, so low risk); and the manager's "Start from an SRD background" clone helper.
    - **Verify (done):** authored a 2-feature background in the manager (`Wanderer's Instinct` +1 STR, `Silver Tongue` +1 AC), confirmed the live preview and a reload/edit round-trip both preserve both rows correctly. Cloned from SRD Acolyte and confirmed it seeds one feature row (`Shelter of the Faithful`). Created a character with the custom background: sheet shows both features as separate entries, ability score reflects the +1 STR bonus (16→17) and AC reflects the +1 AC bonus (10→11) via `sheetData.features[]`. Full backend suite (21 tests) still green.

101. ✅ **Feat prerequisites, shown as a warning (not enforced).** `customFeatDataSchema` has no prerequisite field, so "Str 13 or higher" or "Spellcasting ability" can only live in the description.
    - **Schema:** add to `customFeatDataSchema` — `prereqAbility: Partial<Record<Dnd5eAbility, number>>` (minimum score, covers the most common "X 13 or higher"), `prereqLevel: number` (0 = none), and `prereqText: string` for everything not worth modelling structurally ("Proficiency with heavy armor", "Elf or half-elf"). Deliberately **not** a full prerequisite DSL.
    - **Policy — warn, don't block** (decided): render the prerequisite in the picker and turn it red when unmet, but keep the feat selectable. This matches the established house rule already documented in [srd-invocations.ts](shared/src/systems/srd-invocations.ts): prereqs are *"shown as a hint in the picker, not hard-enforced (a DM may waive prerequisites at the table)"*, and `InvocationPickerModal` already renders unmet prereqs in red without disabling. Mirror that exactly rather than introducing a second, stricter policy for feats.
    - **Manager form:** prereq inputs in the feat sub-editor (six optional ability-minimum numbers, a level number, a free-text line).
    - **`FeatPickerModal`** ([FeatPickerModal.tsx](frontend/src/components/systems/FeatPickerModal.tsx)): show a prereq line per feat, evaluated against the sheet via `effectiveAbilityScore` (so an item/feature bonus counts toward meeting it) and `sheet.level`; style unmet ones in red, same as the invocation picker.
    - **Verify (done):** authored "Powerful Build" (Str 13 min, plus free-text "Str 13 or higher") in the manager. On a Str 17 character, the picker showed the prereq line in gray (`#888`) and it was pickable. Edited the feat to Str 20 (unmeetable) and confirmed the line turned crimson (`rgb(220,20,60)`) while the button stayed enabled (`disabled: false`) and clicking it still added the feat to the sheet — confirming warn-don't-block end to end.

102. ✅ **Feats that grant a *choice* of spells (e.g. Magic Initiate).** `grantedSpells` is a fixed list pushed straight onto the sheet, so it can't express "choose a class, then learn 2 cantrips and 1 first-level spell from it" — the single most common shape among spell-granting feats (Magic Initiate, Ritual Caster, Spell Sniper, Eldritch Adept…).
    - **Schema:** add `spellChoices: [{ count, from: {kind:"class", classId} | {kind:"list", srdIds[]} | {kind:"any"}, maxLevel, atWill }]` (max ~3 rows) **alongside** the existing fixed `grantedSpells` — several feats grant both a fixed spell and a choice.
    - **Flow change (the real work):** `FeatPickerModal.onPick` currently returns `(feat, grantedSpells)` synchronously. A feat with unresolved choices needs a resolution step before the feat is added. **Reuse [`WizardSpellbookPicker`](frontend/src/components/systems/WizardSpellbookPicker.tsx)** — it already does exactly "choose exactly N, class-filtered, level-capped", and was generalized with a `classId` prop in #72; `onlyLevel: 0` handles the cantrip rows. Chain one picker per choice row, then call `onPick` once with fixed + chosen spells combined.
    - **Critical detail:** chosen spells MUST use the same `feat-spell-${feat.id}-${i}` id tagging as fixed grants — `removeFeat` cleans up granted spells by that prefix, so anything tagged differently silently leaks onto the sheet when the feat is removed.
    - **Ordering dependency:** this makes the feat picker multi-step, which makes **#94a** (FeatPickerModal is unmounted when the Feats section is collapsed — the default state at a character's *first* ASI) both more likely to be hit and harder to debug. **Fix #94a first or in the same batch.** (#94a was already fixed earlier in this session, so no extra work needed here.)
    - **Verify (done):** authored "Magic Initiate (Wizard)" with two `spellChoices` rows (2 Wizard cantrips at-will, 1 Wizard level-1 spell) plus the existing prereq/bonus fields. Took it via the standalone "Add feat" control: the picker chained two `WizardSpellbookPicker` steps (caught and fixed a real bug along the way — the picker wasn't remounting between steps, so its internal selection count leaked from step 1 into step 2; fixed by keying it on `stepIndex`). Confirmed via the raw character API response that all 3 chosen spells landed with `feat-spell-${feat.id}-{0,1,2}` ids and the right `atWill`/level values. Removed the feat and confirmed `sheetData.spells` went back to `[]` while the unrelated "Powerful Build" feat and the #100 background features were untouched. Full backend suite (21 tests) still green throughout.

## Theme: subclasses deep enough for a real published subclass

The subclass creator stores `parentClass` + `levels[{ level, features: string[] }]` — feature
**names only** (≤60 chars), which become blank sheet entries on level-up. Hexblade
(dnd5e.wikidot.com/warlock:hexblade) is the benchmark: it needs rules text, an expanded spell
list, proficiency grants, and two per-rest resources, none of which the schema can express.

**Licensing note:** Hexblade is Xanathar's Guide, *not* SRD 5.1 CC-BY. Every `srd-*.ts` file
carries a CC-BY provenance header, so Hexblade's text must **not** be committed as repo data.
The goal is a creator capable enough that a DM authors it in their own instance.

**Decisions taken (both by the user):** subclass spells carry a **per-row list/granted mode**
(expanded lists add options; domain-style spells are handed over outright); resources get a
**real tracked counter**, not description text.

103. ✅ **Subclass features carry rules text and mechanics, not just a name.** `classLevelEntrySchema.features` is `string[]` and is shared with `customClassDataSchema` *and* the SRD `ClassLevelEntry` type — so widen nothing there; add a parallel rich array on the subclass schema instead.
    - **Schema:** `features: [{ id, level, name, description (≤1000), ...effectBonusesSchema, skillProficiencies, armorProficiencies, weaponProficiencies, toolProficiencies }]` on `customSubclassDataSchema`. Reuse `effectBonusesSchema` exactly as #100 did for background features.
    - **Legacy merge, no migration:** `subclassFeatureNames()` ([Dnd5eSheet.tsx](frontend/src/components/systems/Dnd5eSheet.tsx)) becomes `subclassFeaturesAt(subclass, level)` returning rich entries, merging the new array with legacy `levels[].features` names (mapped to empty-description entries). SRD subclasses keep working untouched through the same path.
    - **Level-up:** the blank-entry builder in `levelUp()` stops hardcoding `description: ""` / zero bonuses and carries the real values through — same shape change #100 made to the wizard's `backgroundGrants()`.
    - **Armor/weapon/tool proficiency is cosmetic in this app** (`proficienciesText` is free text, nothing computes off it), so granting them = appending to `proficienciesText` on level-up. Skill proficiencies use the existing structured `skillProficiencies` path that `effectSkillProficiencies` already aggregates.
    - **Verify:** author Hex Warrior with medium armor/shields/martial weapons + rules text; level a Warlock into it; the sheet shows the text and the proficiency line, and removing it doesn't strand the text.

104. ✅ **Subclass spell lists, per-row list-vs-granted.** Nothing today lets a subclass touch spells at all.
    - **Schema:** `spells: [{ id, level (character level it applies), srdId, name, spellLevel, mode: "list" | "granted", atWill }]`. `"list"` = added to what the pickers offer; `"granted"` = pushed onto `sheet.spells` at that level, tagged `subclass-spell-${id}` so it can be cleaned up the same way feat grants are.
    - **Pickers:** [`SpellPickerModal`](frontend/src/components/systems/SpellPickerModal.tsx) already has the escape hatch — `overrideAllClasses || s.classes.includes(classId)`; add an `extraSpellIds: Set<string>` alongside it. [`PrepareSpellsModal`](frontend/src/components/systems/PrepareSpellsModal.tsx) filters the same way and needs the same set.
    - **Verify:** Hexblade's 10-spell expanded list (Shield/Wrathful Smite … Banishing Smite/Cone of Cold) shows up as *selectable* for a Hexblade warlock at the right levels and is absent for a Fiend warlock; a `"granted"` row lands on the sheet instead.

105. ✅ **Generic per-rest tracked resources (generalizes the martial pools).** Hexblade's Curse is 1/short rest, Accursed Specter 1/long rest. `sheet.martialUsed` is already `z.record(z.string(), …)` so **no data migration is needed** — only `MartialResourceKey` ([class-progression.ts](shared/src/systems/class-progression.ts)) is a hardcoded `"rage"|"actionSurge"|"indomitable"|"ki"` union.
    - **Schema:** `resources: [{ id, name, level, uses (fixed int), recharge: "short"|"long", note }]` on the subclass. Fixed int is deliberate — it covers Hexblade exactly; proficiency-bonus/ability-mod scaling is a later extension, not v1.
    - **Generalize:** widen `MartialResourceKey` to `string`, and add a builder that maps subclass resources into the existing `MartialResourcePool` shape (`{key, label, max, resetOn, note}`) under a namespaced key (`subclass:${id}`) to avoid colliding with `rage`/`ki`. Concatenate into the pools the sheet already renders.
    - **Rest handling then needs no new code:** `longRest`/`shortRest` already reset via `martialResetKeys(pools, restType)`, so pools from a subclass clear on the right rest automatically. This is the payoff for generalizing rather than special-casing.
    - **Verify:** Hexblade's Curse counter appears at level 1, spends and resets on a short rest; Accursed Specter resets only on a long rest; a Barbarian's Rage is unaffected.

106. ✅ **Manager UI for all of the above.** The subclass editor is currently two inputs per level row (comma-separated names + `key:value` martial text) — not enough surface for any of #103-105.
    - Rebuild it as three repeatable card lists (features / spells / resources), matching the card pattern #100 established for background features and #102 for feat spell choices, and keep the existing level-row grid for the martial/slot progression.
    - **Verify:** author the whole Hexblade subclass end to end, save, reload, and confirm every field round-trips through the schema.

**Verified (#103-106, done):** authored the full Hexblade in the manager — 5 features with rules
text (Hex Warrior carrying medium armor/shields/martial weapons), the 10-spell expanded list, and
both resources — saved and confirmed every field round-trips through the schema on re-edit.
On a level-1 Warlock: selecting Hexblade granted Hexblade's Curse (253 chars) and Hex Warrior
(259 chars), and appended `Hex Warrior — Armor: Medium armor, Shields; Weapons: Martial weapons`
to proficienciesText without clobbering the base Warlock line. `Shield` (not a Warlock spell)
appears in the spell picker while `Fire Bolt` does not and `Blur`/`Cone of Cold` stay hidden until
their unlock levels. The Hexblade's Curse counter spends to 0/1 and returns to 1/1 on a short
rest; at level 6 Accursed Specter appears as a separate long-rest pool. Full backend suite (21)
green throughout.

**Two things found while verifying, both fixed:**
- Selecting a subclass granted nothing at levels already reached — subclasses are chosen *after*
  character creation, so a level-1 Hexblade silently got no features at all. Fixed by extracting
  `mergeGrants()` and having both `levelUp()` and the new `chooseSubclass()` go through it, so
  the two paths can't drift.
- 4 of Hexblade's 10 expanded spells (Wrathful Smite, Elemental Weapon, Staggering Smite,
  Banishing Smite) aren't in the SRD 5.1 dataset at all. Subclass spell rows now fall back to
  resolving against the author's own custom spells by name, so an expanded list isn't silently
  truncated to whatever the SRD happens to include.

**Follow-up (done):** the manager now flags a subclass spell row whose name resolves to neither
an SRD spell nor any *visible* custom spell (own or approved — matched against the same set the
sheet resolves against, so it can't false-positive on someone else's approved spell). The input
turns red with a note pointing at Type → Spell. Verified on the authored Hexblade: exactly the 4
non-SRD rows flagged and the 6 SRD ones stayed clean; authoring "Wrathful Smite" as a custom
spell dropped the count to 3 and the spell then appeared as "Wrathful Smite (homebrew)" in the
character's level-1 picker alongside SRD "Shield".

107. ✅ **Base class table handed every character its default subclass's features.** Found while verifying #103-106: a Hexblade warlock picked up "Dark One's Own Luck" at level 6.
    - **Cause:** the 5e-database import flattened each class's one SRD subclass into `CLASS_PROGRESSION` as extra same-level rows (`{ level: 6, features: ["Dark One's Own Luck"] }` next to the real level-6 row). `classLevelEntry()` merges every row at a level, so all of them applied. A comment described these as "features split across lines for readability", which is what hid it. **All 12 classes** were affected, not just Warlock — Rogues got Thief features, Fighters got Champion's, etc.
    - **Fix (done):** removed the 49 offending rows (audited programmatically: only rows that were exactly `{level, features}` *and* whose every feature name belonged to that class's SRD subclass), plus one empty `{ level: 18 }` paladin row from the same import. Subclass features now come solely from `SRD_SUBCLASSES` / a custom subclass via `subclassFeaturesAt()`. Placeholder names like "Otherworldly Patron feature" are genuine class-table entries and deliberately stay.
    - **Knock-on caught during verification:** with those rows gone, `chooseSubclass()`'s early return for non-custom subclasses meant an *SRD* subclass now granted nothing at all (it had been silently relying on the buggy rows). Both SRD and custom subclasses now back-fill through the same path.
    - **Verify (done):** level-6 Hexblade warlock has Hexblade's Curse / Hex Warrior / Accursed Specter and no Fiend features; a level-1 SRD Fiend warlock gets exactly "Dark One's Blessing". Programmatic check across all 12 classes × 20 levels: zero subclass features leaking from base tables, 12/12 base-feature spot checks intact, slots and spellsKnown unchanged. (The one flagged name, Ranger L8 "Land's Stride", is a genuine Ranger class feature that collides by name with the Druid Land circle's — the removal script matched per-class so it was never at risk.)
    - **Note:** existing characters keep any wrong feature already written onto their sheet; features are materialized at level-up, so this fixes future grants only.

108. ✅ **Concentration was not modelled at all.** No flag on spells, no sheet field, no way to see or drop what you were sustaining.
    - **Data gap found first:** the 5e-database import stripped the `"Concentration, "` prefix off duration strings, so Blur read `"Up to 1 minute"` rather than `"Concentration, up to 1 minute"`. That surviving `"Up to "` phrasing is an exact proxy — 126 of 319 spells, and validated against known edge cases in both directions (Heroism *is* concentration; Spiritual Weapon is *not*). Backfilled an explicit `concentration?: boolean` on `SrdSpell` from it rather than leaving the app to re-derive from prose forever; asserted flag and duration agree on every row.
    - **Schema:** `concentration` on `customSpellDataSchema` (checkbox in the manager, carried through `customSpellToSrdShape`) so homebrew can set it; `concentratingOn: { spellId, spellName } | null` on the sheet. 5e allows exactly one, so casting another replaces rather than stacks.
    - **Decisions taken (both by the user):** the damage → save trigger is a **manual "damage taken" box**, not HP-watching — HP here is a free-form number input, so auto-detection would fire on typos and manual corrections. Breaking **clears only the marker**: the spell's effects were never modelled, so there is nothing else to unwind.
    - **Save:** DC `max(10, floor(damage/2))` (PHB 203) via `concentrationSaveDC()`, rolled as a plain CON save through the existing dice API. Failure breaks. A long rest clears concentration too.
    - **Verify (done):** cast Blur on a level-6 Hexblade → panel appears and persists to the API. DC scales correctly (0/9/20 → 10, 31 → 15, 100 → 50). Save rolls `1d20+2` — CON 14, no CON save proficiency — and "held" on success. Casting Hold Person showed `(concentration — drops Blur)` in red and swapped rather than stacked. Break and Long rest both clear it.
    - **Bug caught during verification:** the result message was rendered *inside* the panel, which is conditional on `concentratingOn` — so the panel unmounted the instant a save failed and took the roll that broke it with it. The panel now also renders (with a Dismiss) when there's an outcome but no concentration, so you see "…vs DC 50 — failed: Blur ends."

109. ✅ **Custom spells never appeared in the subclass (or feat) spell autocomplete.** Reported after #104 shipped.
    - **Cause:** both `<datalist>`s in the manager were built from `SRD_SPELLS` alone, so a homebrew spell was never suggested — you had to know to type the name exactly. The #104 warning then made this worse-feeling: it correctly said the row was unresolved, but the autocomplete gave no way to find the spell that would resolve it.
    - **Fix (done):** one `spellNameOptions` list (SRD + every *visible* custom spell, deduped by name so a homebrew spell can deliberately shadow an SRD one) now backs both autocompletes **and** the unresolved-name check, so what's suggested and what's accepted can't drift apart.
    - **Second bug the fix exposed:** once the *feat* autocomplete offered custom spells, its save path still resolved only against `SRD_SPELLS` — a picked homebrew spell would have saved with no id. Added a shared `resolveSpellName()` (SRD first, then visible custom as `custom-${id}`, matching `customSpellToSrdShape`) used by both the subclass and feat paths.
    - **Verify (done):** subclass datalist went 319 → 320 and now contains "Wrathful Smite"; the 3 genuinely-absent spells still warn. Re-saving Hexblade upgraded that row from `srdId: "", spellLevel: 0` to `srdId: "custom-19", spellLevel: 1` — the level had been wrong too, since it was only surviving via the sheet's read-time name fallback. Character picker still shows "Wrathful Smite (homebrew)" beside SRD "Shield".

## Theme: spells that buff your attacks

Prompted by "Wrathful Smite should provide an attack bonus". Worth stating precisely: Wrathful
Smite grants **extra damage** (*"the next time you hit with a melee weapon attack… an extra 1d6
psychic damage"*), not a bonus to the attack roll — but the general feature has to cover both,
since Bless and Magic Weapon really do buff the roll.

**Three gaps, not one.** (a) There is no active-spell effect source at all: `allEffectEntries()`
is feats + features and is *always on*, items gate on `itemBonusesActive()` (equipped + attuned),
and spells contribute nothing. (b) `effectEntrySchema`'s `attackBonus`/`damageBonus` are
`z.number().int()` — **integers only**, so `+1d6 psychic` is inexpressible even once a spell can
contribute. (c) There's no consumption model: Wrathful Smite is next-hit-only, Hex is every hit,
Bless is every attack roll.

**Decisions taken (both by the user):** curate the SRD buff spells *in addition to* custom-spell
buff fields; and **auto-consume** once-only effects on the next damage roll.

**Licensing constraint found while scoping:** Hex, Wrathful Smite, Elemental Weapon and most
smites are **not in SRD 5.1** — only Bless, Divine Favor, Hunter's Mark, Magic Weapon, Branding
Smite, Shillelagh, True Strike and Spirit Guardians are. So the curated table covers those eight
only; everything else is authored as a custom spell (which is how Wrathful Smite already exists
in this instance). Keep the table in its own file with a provenance note, the way
`CLASS_STAT_PRIORITY` is explicitly marked "not licensed SRD content" — do **not** append to
`SRD_SPELLS`, whose header claims a single upstream source.

110. ✅ **Dice-valued, typed bonuses.** Extend the bonus vocabulary beyond flat ints.
    - **Shape:** `attackDice: string` (Bless "1d4"), `damageDice: string` ("1d6"), `damageType: string` ("psychic"), alongside the existing flat `attackBonus`/`damageBonus`. Validate as a dice expression, not free text.
    - Deliberately **not** retrofitted onto `effectEntrySchema` (feats/features/items are flat-bonus things and always-on); this belongs to the new active-effect entry in #111 so the always-on path keeps its simple integer maths.

111. ✅ **`activeEffects` on the sheet, with consumption and concentration linkage.**
    - **Schema:** `activeEffects: [{ id, name, sourceSpellId?, ...#110 fields, consumption: "once" | "per-hit", endsWithConcentration: boolean }]`.
    - **Concentration linkage is the payoff from #108:** seven of the eight SRD buff spells are concentration spells, so an effect flagged `endsWithConcentration` clears in `breakConcentration()` and on a failed save — the existing single hook, no new bookkeeping.
    - **Auto-consume:** a `"once"` effect is folded into the next damage roll and then removed. **This makes the damage roll mutate sheet state**, which it currently doesn't — `AttackRollControl` needs an `onConsume` callback up to the sheet, and a mis-clicked roll will burn the smite. Accepted, but keep the removal visible (log it in the roll result) so it's never silent.
    - **UI:** an "Active effects" box mirroring the #108 Concentration panel — each effect with its dice/type and a manual remove.

112. ✅ **Authoring: custom-spell buff fields + the curated SRD table.**
    - `customSpellDataSchema` gains the #110 fields plus `consumption`, so "Wrathful Smite → 1d6 psychic, once" is authorable; manager gets the inputs.
    - New `srd-spell-effects.ts`: `Record<srdId, BuffEffect>` for the eight SRD spells above, with the not-from-the-import provenance note.
    - Casting a spell that has a buff (custom field or curated entry) creates the `activeEffect`, reusing the `onConcentrate` hook point in `SpellCastControl` added by #108.

113. ✅ **Attack roll plumbing.** `AttackRollControl` takes a flat `magicBonus: number` and builds `damageDice + magicBonus`; `attackBonus()` returns a single int.
    - Both need to carry **extra dice terms**: the d20 roll gains Bless's `+1d4`, the damage roll gains `+1d6` and should report its type ("7 psychic") rather than silently folding into the total.
    - **Verify:** author Wrathful Smite with 1d6 psychic/once, cast it, confirm the effect appears, the next damage roll includes `+1d6` and reports psychic, the effect then disappears, and a second attack in the same turn does **not** get it. Confirm Bless adds 1d4 to the d20 and persists across hits. Confirm breaking concentration ends a linked effect.

**Verified (#110-113, done):** edited "Wrathful Smite" (the custom spell from #109) to add its
buff -- 1d6 psychic, once -- via the manager's new "Attack/damage buff" section, separate from
"Damage dice" (which is a spell's own cast-time damage, e.g. Magic Missile). Cast it on a
Hexblade warlock: the Cast button showed "(buffs your attacks: +1d6 psychic dmg, next hit)", an
Active Effects panel appeared, and rolling the character's weapon attack and confirming Hit
produced `Damage: 1d8-1: [1]-1 = 0 piercing` followed by `+1d6: [1] = 1 psychic (Wrathful
Smite)` as its own line -- then the effect vanished from both the panel and the API. Recast and
clicked Miss instead: the effect survived, matching Wrathful Smite's own text ("if you don't
hit... the spell isn't wasted").

Cast the curated SRD table's Bless (not on the Hexblade's own list -- added via "show all
classes' spells"): the attack roll became a single formula, `1d20+1d4+2: [1]+[1]+2 = 4`, and the
effect survived a confirmed Hit (per-hit, not consumed). Breaking concentration cleared it.
Casting Hold Person while Bless was active correctly dropped Bless's activeEffect the instant the
new concentration started (`beforeEffects: ["Bless"]` → `afterEffects: []`), confirming replace-
not-stack for concentration-linked effects specifically, distinct from #108's replacement of
`concentratingOn` itself.

**Found and fixed a real pre-existing bug while wiring the curated table:** Branding Smite and
Divine Favor had `damageDice`/`damageType` set on their SRD entries with no `requiresAttackRoll`,
which made `SpellCastControl` roll their bonus damage immediately on cast rather than on the
caster's next weapon hit as their actual text says. Stripped those fields now that the buff is
modelled correctly via the new activeEffects path.

**Flagged, not fixed (spawned as a separate task):** the same audit turned up several other SRD
spells with the identical damageDice-without-requiresAttackRoll shape (Scorching Ray, Call
Lightning, Fire Shield, Flame Blade, Flaming Sphere) that may have the same bug in the other
direction -- an attack-roll spell auto-hitting. Unrelated to buff spells specifically, so spun off
rather than fixed inline.

## Theme: parent-class/race fields are free text, one typo from silently not matching

Prompted by "subclasses aren't working." The likely cause: a custom subclass's `parentClass`
([CustomContentManager.tsx](frontend/src/pages/CustomContentManager.tsx)) is a plain text input,
matched against the character's `sheet.class` via `.trim().toLowerCase() === ...` in
[Dnd5eSheet.tsx](frontend/src/components/systems/Dnd5eSheet.tsx). Trimming/casing are already
forgiving, but the *spelling* has to match exactly — "Warlok", a trailing character, or anything
not byte-for-byte the class's name and the subclass silently never appears in the Subclass
dropdown, with no error anywhere to say why.

114. ✅ **`parentClass` becomes a dropdown, sourced from the same classes a character can actually have.** A character's `sheet.class` is one of: an SRD class name (`DND5E_CLASSES`), a custom class's name, or — if "Other (homebrew)" was picked at character creation — arbitrary free text ([Dnd5eSheet.tsx:1085-1109](frontend/src/components/systems/Dnd5eSheet.tsx)). The dropdown has to cover all three or it'd be *more* restrictive than character creation itself, not just safer.
    - **Options:** SRD classes (`DND5E_CLASSES`, matching the `<select>` already used for the character's own Class field) + an optgroup of every *visible* custom class (own + approved — same "visible" convention #109 established for spell autocompletes, needs a new `visibleClasses` fetch in the manager alongside the existing `visibleSpells`) + a trailing **"Other (homebrew)"** option that reveals a free-text fallback input. Mirrors the character sheet's own Class field exactly (SRD + custom optgroup + Other-homebrew-with-text-input), rather than inventing a second convention.
    - **No schema change** — `parentClass` stays a `string`; only the manager's input control changes from `<input>` to `<select>` (+ conditional text input for Other). Existing subclasses with a typo'd `parentClass` are unaffected until re-saved (loading a mistyped value into the dropdown will fall through to "Other (homebrew)" with the stored text preserved, not silently blank it).
    - **Verify:** author a subclass, pick a class from the dropdown, confirm it appears in that class's Subclass options on a character sheet. Pick "Other (homebrew)", type a class name matching a character whose class was itself homebrew-typed, confirm the same. Re-open an existing (pre-fix) subclass with a typo'd parentClass and confirm the typo'd text survives into the Other-homebrew fallback rather than being lost.

115. ✅ **Same bug, same fix, for `parentRace` (subraces).** [CustomContentManager.tsx:1824](frontend/src/pages/CustomContentManager.tsx) has the identical free-text `Parent race` input, matched the identical way in Dnd5eSheet.tsx's subrace filter. Not reported broken, but it's the same bug in the same file for the same reason — worth doing in the same pass rather than waiting for a second "X isn't working" report. Same dropdown shape: `SRD_RACES` + visible custom races + Other-homebrew fallback.
    - **Verify:** same as #114, substituting race/subrace.

**Verified (#114-115, done):** added `visibleClasses`/`visibleRaces` state to CustomContentManager
(same "visible, not just own" fetch #109/#126 already established for spells/feats), and turned
both `parentClass`/`parentRace` from a bare `<input>` into the exact SRD-optgroup-Custom-optgroup-
Other-homebrew `<select>` pattern Dnd5eSheet.tsx's own Class/Race fields already use -- no new UI
convention invented. No schema change: `parentClass`/`parentRace` stay plain strings, only the
manager's input control changed.

Live-verified end-to-end: created a custom "Bloodrager" class, then a subclass with the dropdown's
Custom optgroup selecting "Bloodrager (pending)" -- saved `parentClass: "Bloodrager"` byte-exact.
Created a character with `class: "Bloodrager"` and confirmed the subclass actually appeared as a
Subclass option on its sheet, closing the loop on the original "subclasses aren't working" report.
Separately POSTed a subclass directly with a typo'd `parentClass: "Warlok"` (simulating a pre-fix
row) and confirmed re-opening it in the manager fell through to "Other (homebrew)" with "Warlok"
preserved in the fallback text input, not silently lost. Repeated the SRD-selection check for
`parentRace` on a subrace (picked "Dwarf" from the dropdown, confirmed the select value stuck).
Full build across all three workspaces clean, 21 backend tests green. Test users/content cleaned
up afterward.

116. ✅ **Bug: sheet PATCH rejected the instant a subclass with full rules text was chosen.** Reported live: "my sheet wont save with the custom hexblade class."
    - **Cause:** `subclassFeatureSchema.description` (custom-content.ts) allows up to 1000 characters, deliberately sized for real rules text (Hexblade's Curse and Hex Warrior's official text both run 700-800+ chars). But `chooseSubclass()`/`mergeGrants()` copies a granted feature's description straight onto a sheet entry validated by `effectEntrySchema`, which was still capped at 500 — the one length mismatch in the whole feat/feature/background-feature family (everything else authors and stores at a consistent 500). Any subclass feature over 500 chars made the PATCH a guaranteed 400, with the sheet just silently failing to save.
    - **Found via:** SSH'd to the production server (`myserver`), read-only queried the live sqlite DB in place (never copied off-server) for the reporter's actual character + their authored "The Hexblade" custom subclass, then replayed `chooseSubclass()`'s exact logic in a local Node script against the real shared schema to get the actual zod `issues` array rather than guessing.
    - **Fix (done):** raised `effectEntrySchema.description` to `.max(1000)` to match, in [dnd5e.ts](shared/src/systems/dnd5e.ts).
    - **Verify (done):** reran the same reproduction script post-fix against the reporter's real data — `VALID`. Full build + 21 backend tests green.
    - **Not this bug, but found along the way:** the live server had zero auto-deploy (`docker-image.yml` only builds/pushes to GHCR; `docker compose pull && up -d` on the server is a manual step) — a real gap worth knowing about, though not the cause here since the reporter deploys manually and confirmed the server was already on the latest pushed commit.

## Theme: spell scaling (upcasting + cantrip growth)

Requested: "some spells have a scaling element, for example Fireball for each level above the
third it adds 1d6 — can we implement this on SRD spells and make it an option in the spell
creator." Nothing in the app scales anything today.

**Two independent axes, both missing.** *Slot upcasting* (cast Fireball with a 5th-level slot →
+2d6) and *cantrip growth* (Fire Bolt 1d10 → 4d10 at character levels 5/11/17). Only Eldritch
Blast scales at all, via bespoke `eldritchBlastProfile()`/`eldritchBlastBeams()`
([srd-invocations.ts](shared/src/systems/srd-invocations.ts)) — the other 9 damage cantrips never
grow.

**Prerequisite, and it's a real UX change not a detail:** you can't choose a slot level. `consumeSlot()`
([Dnd5eSheet.tsx](frontend/src/components/systems/Dnd5eSheet.tsx)) always takes `candidateSlots[0]`,
the *lowest* available slot at or above the spell's level. Upcasting is meaningless until that's a
choice. Warlocks are exempt by construction — Pact Magic grants a single slot level, so
lowest-available is already the only (and correct) option for them.

**Scope honesty (decided with the user):** of the four categories raised — extra damage, more
targets, increased duration/effect, general utility — **only extra damage is mechanically
applicable.** The app models no targets, no other creatures' HP, and no durations, so the other
three become a freeform "at higher levels" note rendered with the chosen slot level substituted in,
rather than three schemas that could only ever print text. **Decisions taken (all three by the
user):** freeform note for non-damage; bundle cantrip scaling into the same batch; curate all 52
SRD damage spells rather than a popular subset.

**Licensing:** unlike Hexblade (#103-106), SRD 5.1 "At Higher Levels" text *is* CC-BY and safe to
ship. But the 5e-database import didn't carry it, so it's hand-transcribed — keep it in its own
file with a provenance note, exactly the precedent [srd-spell-effects.ts](shared/src/systems/srd-spell-effects.ts)
set in #110-113, rather than appending to `SRD_SPELLS` whose header claims a single upstream source.

117. ✅ **Choose a slot level when casting.** Prerequisite for everything below.
    - `SpellCastControl` gains a slot-level selector defaulting to the spell's own level, listing every level from the spell's base up to the highest slot the character *has available*. `onConsumeSlot` takes the chosen level instead of `consumeSlot()` picking for you; `candidateSlots` stops being an implicit "lowest wins".
    - **Hide the control when it can't matter** — a cantrip, an at-will grant, a ritual cast, or a caster with exactly one distinct slot level (every Warlock). Otherwise it's noise on the majority of casts.
    - **Verify:** a Wizard with 1st/2nd/3rd slots casting Magic Missile can pick each level and the *chosen* slot decrements, not the lowest; a Warlock sees no selector and still casts correctly.

118. ✅ **Scaling data: curated SRD table + spell-creator fields.**
    - **New `srd-spell-scaling.ts`:** `Record<srdId, SpellScaling>` where `SpellScaling = { damageDicePerLevel?: string; note?: string }` — `damageDicePerLevel` is the rollable part ("1d6" for Fireball, "1d8" for Cure Wounds), `note` the freeform line for target/duration/utility upcasts. All **52** leveled spells that carry `damageDice`, hand-transcribed from their own "At Higher Levels" text; plus notes for the well-known non-damage ones (Aid, Invisibility, Command, Hold Monster, Dispel Magic, Planar Binding).
    - **Watch for the not-simply-more-dice cases** while transcribing: Magic Missile (+1 dart, not +1 die), Scorching Ray (+1 ray) — these are `note`-only, since "add 1 dart" isn't expressible as extra dice on one roll. Don't force them into `damageDicePerLevel`.
    - **`customSpellDataSchema`** gains the same two fields, with inputs in the manager's spell editor sitting near the existing Damage dice/type row.

119. ✅ **Apply scaling at cast time.**
    - `SpellCastControl` computes `levelsAbove = castLevel - spell.level` and, when `damageDicePerLevel` is set, appends it `levelsAbove` times to the damage formula — reusing the multi-term formula approach #113 already established for `extraAttackDice`, not a second string-building convention.
    - Render the resolved scaling next to the Cast button (e.g. "at 5th: 10d6 fire") and the freeform `note` with the chosen level substituted, so a non-damage upcast is at least *visible* at the table.
    - **Verify:** Fireball at 3rd rolls 8d6, at 5th rolls 10d6; Cure Wounds at 1st/4th scale by 1d8 each step; Magic Missile shows its note and does **not** silently add dice; a custom spell with authored scaling behaves identically to an SRD one.

120. ✅ **Cantrip growth on character level.** A single 5e rule, not per-spell data: a damage cantrip's dice *count* multiplies at character levels 5/11/17.
    - Those exact thresholds already exist in `eldritchBlastBeams()` ([class-progression.ts:497](shared/src/systems/class-progression.ts)) — **factor a shared `cantripScaleMultiplier(level)` (1/2/3/4) and have both call it**, rather than writing the magic numbers a second time.
    - Applies to a cantrip's `damageDice` by multiplying the dice count (`1d10` → `3d10` at 11th). **Eldritch Blast is excluded** — it scales by *beams*, and its bespoke profile already handles that; double-applying would quadruple it.
    - **Verify:** Fire Bolt reads 1d10 at level 4, 2d10 at 5, 4d10 at 17; Eldritch Blast still shows beams and is not additionally dice-scaled; a level-1 character sees no change anywhere.

**Verified (#117-120, done):** built a level-9 Wizard (slots at 1-5) and a level-9 Warlock (Pact
Magic, level-5 slots only) and drove both in the browser.

- **Upcast selector** appears only where there's a real choice: Fireball offered 3/4/5, Hold Person
  2/3/4/5, cantrips and the Warlock none. Casting Fireball at 5 showed `(at 5: 8d6+2d6 fire)`,
  rolled `8d6+2d6 = 29`, and **decremented the level-5 slot while level 3 stayed untouched** — the
  behaviour change that makes upcasting mean anything. A spent slot level then correctly dropped
  out of every selector.
- **Magic Missile did not gain dice** when cast at 4th (`3d4 + 3` as written), and its note read
  "…for each slot level above 1st. (casting at 4 — 3 above base)" — the trap called out in #118
  avoided, with the player still told how many extra darts they get.
- **Cantrip growth:** Fire Bolt 1d10 → 2d10 and Chill Touch 1d8 → 2d8 at level 9; Eldritch Blast
  stayed 1d10 with 2 beams, confirming the exemption stops it being scaled twice.
- **Formulas round-trip through the real roller** — checked `8d6+2d6`, `10d6 + 40+9d6`,
  `2d8 + 4d6+2d8` all parse, so compound base damage survives having terms appended.

**Bug caught during verification:** `canUpcast` conflated "no choice of slot level" with "cast at
base level", so a Warlock — who always spends their single highest Pact Magic slot — cast every
spell at its base level. Hellish Rebuke read 2d10 instead of the 2d10+4d10 a 9th-level Warlock
actually deals. Split the two concepts: the *selector* still hides when there's nothing to choose,
but the cast level now follows the slot actually being spent. Re-verified: Hellish Rebuke shows
`(at 5: 2d10+4d10 fire)`, rolls `2d10+4d10 = 46`, spends a level-5 slot, and still shows no selector.

## Theme: custom-content depth (external review recommendations)

Seven recommendations from an outside review of the custom-content system, in the priority order
given. Grounded against the schemas below; a few turned out to be different (or larger) problems
than the summary implied.

**Cross-cutting trap — text caps are coupled.** #116 (today) was exactly this: an authoring cap
raised above the *sheet-entry* cap it feeds makes saves fail with "Invalid D&D 5e sheet data".
Anything whose text is copied onto the sheet must move `effectEntrySchema.description`
([dnd5e.ts](shared/src/systems/dnd5e.ts), now 1000) in the same change. **Feats are coupled** —
`FeatPickerModal.pickCustom` copies `description` straight onto a FeatEntry. **Race traits are
not** — they're only rendered (`raceInfo.traits.join(", ")`), never materialized. Spell/item
descriptions (#121) are display-only and safe at any size.

**Decisions taken (both by the user):** race traits go **straight to rich objects** rather than a
throwaway cap bump first; monsters get **both** the schema fields and a backfill of the missing
SRD data.

121. ✅ **`description` on spells and items.** Neither `customSpellDataSchema` nor `customItemDataSchema` has a description field at all — a homebrew spell can carry damage dice and a save DC but not a single word of what it does. Rated the biggest gap and it is.
    - **Schema:** `description: z.string().trim().max(4000).default("")` on both. Display-only (nothing copies it onto a sheet entry), so it's exempt from the coupling trap above and can be generous.
    - **Render** in the manager editors and wherever the spell/item detail line already shows — the cast control's metadata row and the inventory notes.

122. ✅ **Raise text caps — with the coupled ones moved together.**
    - Feats 500 → 2000, **and `effectEntrySchema.description` 1000 → 2000 in the same commit** or #116 recurs the moment someone writes a long feat.
    - Subclass features already sit at 1000 (#103) and the sheet side matches after #116 — **already satisfied**, no change needed.
    - Background features/variants (500) are also copied to the sheet; raise with the same care if raised at all.
    - Race traits are handled by #124 instead — a cap bump there would be thrown away.

123. ✅ **JSON pack import.** Nothing bulk exists; every item is hand-entered one form at a time.
    - **Shape:** DM/admin-only upload of `{ type, name, data }[]`, validated per-row through the existing per-type schemas (`schemaForType` already exists in [customContent.routes.ts](backend/src/routes/customContent.routes.ts)) so an import can't create anything the forms couldn't.
    - **Partial success matters:** report per-row pass/fail rather than rejecting a 60-item pack for one bad row, and dedupe by (type, name) so re-importing a corrected pack updates instead of duplicating.
    - Wikidot-ish markdown parsing is explicitly **out of scope** for v1 — JSON first, and only consider a parser once the JSON path proves the round-trip.

124. ✅ **Race trait mechanics (rich trait objects).** `traits: z.array(z.string().max(60))` — bare 60-char strings, display-only, zero mechanics. Darkvision, resistances and granted cantrips are all unrepresentable, so a homebrew Tiefling is cosmetic.
    - **Schema:** `traits: [{ id, name, description, darkvisionFeet, damageResistances[], grantedCantrips[], ...effectBonuses? }]`, with a **`z.preprocess` migration from the current `string[]`** (name only, everything else defaulted) — the same no-DB-migration shim pattern #100 used for background features.
    - **Flexible ASI:** `abilityBonuses` is a fixed record, so "+2 to one ability of your choice, +1 to another" (the modern default) can't be expressed. Add a choice shape alongside the fixed record, resolved during character creation.
    - **Sheet application** is the real work, not the schema: darkvision and resistances have nowhere to land today (no senses/resistances fields on `dnd5eSheetSchema`), so this needs sheet-side fields too. Scope check before starting — this is the largest of the seven.

125. ✅ **Monster `legendaryActions` + `skills` + `senses`.** Bigger than "add fields": the **SRD import dropped this data too**. Zero of the 319 SRD monsters have structured `legendaryActions` or `skills`, and 46 dragons/bosses are affected — "Legendary Resistance" survives only as special-ability prose on 30 of them.
    - **Straight data-loss bug first:** `customMonsterToSrdShape` maps `senses: { passivePerception: d.passivePerception }`, silently dropping darkvision/blindsight/tremorsense/truesight, which `SrdMonster.senses` already models. A custom dragon cannot have darkvision. Fix the custom schema to carry the full senses object.
    - **Then** add `legendaryActions` and `skills` to both `SrdMonster` and the custom schema, and **backfill the ~30 legendary SRD monsters** by hand (CC-BY, ships in-repo, same precedent as [srd-spell-scaling.ts](shared/src/systems/srd-spell-scaling.ts)). Without the backfill only newly-authored monsters work and the existing bestiary stays broken.
    - Bestiary/Arena rendering needs the new sections; check both, since Arena drives combat.

126. ✅ **Background `grantedFeats`.** No link from a background to a feat exists.
    - **Shape:** `grantedFeats: string[]` of custom-content ids (or SRD feat ids), resolved at character creation the way `backgroundGrants()` already applies skills/tools/equipment.
    - **Reuse the #109 resolver pattern** — SRD id first, then a visible custom feat — and reuse the #109 unresolved-name warning so a background pointing at a deleted feat says so instead of silently granting nothing.

127. ✅ **Generic class resources.** `martialLevelEntrySchema` is 13 hardcoded fields (rage, ki, sneak attack, action surge…), so Artificer infusions or a Blood Hunter's hemocraft die are inexpressible at class level.
    - **The mechanism already exists** — #105 built exactly this for *subclasses* (`subclassResourceSchema` + `subclassResourcePools()`, riding the generalized `martialUsed` tracker). This is lifting that same shape to `customClassDataSchema`, not new machinery, which makes it far smaller than its position in the list suggests.
    - Odd asymmetry worth closing regardless: today a homebrew resource is expressible on a subclass but not on the class that owns it.

**Verified (#121, done):** built and typechecked clean across all three workspaces (shared,
frontend, backend), 21 backend tests green. `customSpellDataSchema`/`customItemDataSchema` gain
a 4000-char `description`; `SrdSpell` gains an optional `description` field (always undefined
for real SRD entries, populated only via `customSpellToSrdShape`) so a custom spell's text flows
through the existing cast-control render path instead of a parallel one. Item description renders
as a reference line under the item row, kept separate from the player-editable `notes` field
(`customItemNotesText` still seeds that with the mechanical one-liner) so authoring prose can
never clobber a player's own notes.

**Verified (#127, done):** authored a custom "Artificer" class with an Infusions resource
(4 uses, long rest) via a direct API call (test account promoted to `dm` in the dev DB to reach
the manager, same pattern as earlier in this session), put it on a level-2 character, and drove
it in the browser. The counter rendered as "Infusions: 4 / 4 (Known infusions active at once)"
in the same Martial features block Rage/Ki already use. Use spent it to 3/4, storing
`martialUsed["class:res-infusions"]: 1` -- the namespaced key exactly as designed. Long rest
reset it to 4/4 and cleared martialUsed, with **zero new rest-handling code**: `longRest()`
already resets via `martialResetKeys(pools, restType)` over whatever pools are in play, so a
class-contributed pool rode along automatically once added to the `martialPools` list, the same
payoff #105 got for subclasses. Full build + 21 backend tests green.

**Verified (#125, done):** fetched authoritative legendary-action/skills/senses data for all 23
SRD monsters with Legendary Resistance (20 dragons + Vampire + Lich + Tarrasque) from
dnd5eapi.co -- confirmed to mirror the same 5e-bits/5e-database dataset this repo's own SRD
import already cites, cross-checked against existing local data (blindsight/darkvision numbers
matched exactly before any edit). Injected via a scripted, line-scoped patch rather than manual
editing across 23 dense one-line object literals; verified purely additive (23 lines modified,
0 deleted) and the exact expected counts (23 with legendaryActions, 22 with skills -- Tarrasque
has none, correctly). One correction en route: the `MonsterLegendaryAction.cost` field had to be
optional (undefined = 1) to match the zod schema's `.default(1)` and avoid forcing `cost: 1` onto
every single-cost action.

Live-verified: Adult Brass Dragon's Bestiary page shows "Skills History +7, Perception +11..."
and a Legendary Actions section with a rollable Wing Attack -- correctly **without** a Roll
button, since Wing Attack is a save-based effect with no attack roll (the same
attackBonus-required gate regular actions already use). Arena now offers the Vampire's legendary
"Unarmed Strike" and "Bite (Costs 2 Actions)" as extra attack options alongside its regular
actions in an actual fight. Authored a custom "Shadow Wyrm" dragon via the API with
darkvision/blindsight/skills/legendaryActions and confirmed the Bestiary renders "Senses
blindsight 60 ft, darkvision 120 ft, passive Perception 18" -- the exact data-loss bug
(previously only passivePerception survived `customMonsterToSrdShape`) fixed and confirmed live,
not just by reading the code.

**Verified (#123, done):** imported a 3-row pack (2 valid + 1 deliberately invalid) via the
manager's new "Import a pack" box -- result read "2 created, 0 updated, 1 failed" with the exact
zod validation message for the bad row ("level: Number must be less than or equal to 9") and both
good rows still succeeded, confirming per-row partial success rather than all-or-nothing.
Re-imported the same feat name with changed data: count stayed at 1, same content id, and the
new description/acBonus actually landed -- dedup-by-(type, name) updates in place rather than
duplicating. Malformed request bodies are rejected by the shared importCustomContentSchema with
the same per-field zod issues the single-create route already returns. Full build + 21 backend
tests green throughout; POST /api/custom-content/import reuses the exact same dataSchemaFor()
per-type validation and requireGlobalRole("dm", "admin") gate as the existing single-item route,
so an import can't create anything the manager forms couldn't.

**Verified (#126, done):** added `grantedFeats: string[]` (custom-content ids like `custom-24`, or
raw SRD feat names) to `rawCustomBackgroundDataSchema`, plus a shared `resolveGrantedFeat(ref,
customFeats)` resolver mirroring the existing spell/subclass id-tag pattern. `backgroundGrants()`
in the creation wizard now resolves each ref once at character creation, pushing a full feat entry
(abilityBonuses/acBonus/skillProficiencies/etc.) and tagging any of *that feat's own* granted
spells as `feat-spell-${featId}-${i}` -- the same tag `addFeat()` uses on the sheet, so cleanup
logic works regardless of grant source. Manager UI adds a "Granted feats" comma-separated field
with a datalist and the established red unresolved-name warning (#109's pattern) when a background
references a feat that no longer exists.

Live-verified end-to-end: created a custom "Grit" feat (grants Intimidation proficiency + an
at-will Guidance cantrip) and a custom "Hardened Veteran" background with
`grantedFeats: ["custom-24"]` pointing at it, then drove the actual character-creation wizard in
the browser -- picked Fighter/Human/Hardened Veteran, standard-array abilities, created the
character. The resulting sheet shows a Feats entry for Grit (`intimidation` in
`skillProficiencies`, tagged `bg-feat-<uuid>`) and "Guidance" in `spells`
(`feat-spell-bg-feat-<uuid>-0`), exactly as designed. First verification attempt showed empty
`feats`/`spells` -- traced to a test-harness bug, not the app: driving the background `<select>`
via a raw `.value =` assignment doesn't fire React's synthetic onChange, so `background` state
silently stayed empty (class/race, set the same way, happened to have worked). Re-driven with
`form_input` (which dispatches proper events) and the mechanism worked on the first pass. Full
build across all three workspaces clean; 21 backend tests green.

**Verified (#122, done):** raised `customFeatDataSchema.description` 500 → 2000
([custom-content.ts](shared/src/systems/custom-content.ts)) and the coupled
`effectEntrySchema.description` 1000 → 2000 ([dnd5e.ts](shared/src/systems/dnd5e.ts)) in the same
change -- `FeatPickerModal.pickCustom` copies a feat's description straight onto a sheet entry, so
raising only the content-side cap would recreate #116 (saves failing with "Invalid D&D 5e sheet
data") the moment someone wrote a feat past the old 1000-char sheet limit. Subclass features
(already 1000/1000, #103) needed no change; background features/variants and race traits stay out
of scope per the plan (the latter is #124's job).

Live-verified: created a custom feat via the API with a 1804-char description (would have been
rejected outright at the old 500-char content cap) -- accepted, status 201. Added it to an existing
level-9 character's sheet via a PATCH exercising the real `dnd5eSheetSchema`/`effectEntrySchema`
validation path (the same one `FeatPickerModal` drives) -- the full 1804 characters round-tripped
with no truncation, status 200. Full build across all three workspaces clean; 21 backend tests
green.

**Verified (#124, done):** the largest of the seven, as flagged. Replaced `traits: string[]` with
`raceTraitSchema` (id, name, description, darkvisionFeet, damageResistances[], grantedSpells[],
plus the same effectBonuses feats/background-features already carry) on both
`customRaceDataSchema` and `customSubraceDataSchema` -- subraces got the identical shape and
migration, not a lesser version, since Drow's Superior Darkvision is exactly as mechanical as a
race's own traits. A `z.preprocess` migration (`upgradeTraitStrings`) upgrades legacy bare-string
rows into name-only rich objects on read, same no-DB-migration shim #100 used for background
features. Added `abilityBonusChoices` to `customRaceDataSchema` for flexible ASI ("+2 to one
ability of your choice, +1 to another") -- each entry is a bonus amount resolved to a
player-chosen, mutually-exclusive ability during character creation.

**Sheet application was the real work, as scoped:** added `darkvisionFeet`/`damageResistances` to
`dnd5eSheetSchema` (previously nonexistent on a PC sheet at all) and a `raceGrants()` function in
the creation wizard mirroring `backgroundGrants()` -- resolves the selected race's and subrace's
traits once at creation into sheet `features` (tagged `race-trait-${id}-*`), takes the *max*
darkvision across traits (not a sum) and a deduped union of resistances, and pushes any granted
spells (tagged `race-trait-spell-${id}-*`, same convention `feat-spell-*` established). Also closed
a pre-existing gap noted while building this: the wizard never applied race `speed` at all before
now (subrace override wins when nonzero, per its existing "0 = inherit" convention). Manager UI
replaced the shared comma-separated `<input>` (race and subrace reuse one `traitRows` state, same
as `abilityBonuses`) with repeatable trait cards, each with a pipe-delimited granted-spells textarea
resolved through the same `resolveSpellName` closure feats already use. `Dnd5eSheet.tsx`'s inline
trait-name summary line needed a `traitDisplayNames()` normalizer since `.traits` is now
`RaceTrait[]` for custom races but stays `string[]` for every `SrdRace`/`SrdSubrace` (`.join()`
would otherwise silently print `[object Object]` -- caught by inspection, not by `tsc`, since
`Array.prototype.join` accepts any element type).

Live-verified end-to-end: authored a custom race (fixed DEX+2, flexible `[+2, +1]` ASI choices, a
trait granting 90 ft darkvision + necrotic resistance + an at-will Guidance cantrip) and a subrace
(120 ft darkvision, poison resistance, plus one deliberately-legacy plain-string trait to exercise
the migration), then drove the actual wizard UI: picked the race, chose STR for the +2 slot and CON
for the +1 slot (each slot's dropdown correctly excludes the ability already taken by the other),
picked the subrace. Final abilities landed exactly right (STR 15+2=17, DEX 14+2=16, CON 13+2=15)
and the created character's sheet showed `darkvisionFeet: 120` (max of 90/120, not 210),
`damageResistances: ["necrotic","poison"]` (deduped union), `speed: 30` (inherited, subrace had no
override), 3 feature entries with correct names (not `[object Object]`), and "Guidance" in `spells`
with `atWill: true`. The legacy string trait rendered correctly as plain text alongside the rich
one, confirming the migration path. Full build across all three workspaces clean; 21 backend tests
green.

**Wikidot-ish markdown import remains explicitly out of scope**, per the plan -- JSON first.

## Theme: admin portal — manage all custom content and characters

Today's admin portal ([AdminPanel.tsx](frontend/src/pages/AdminPanel.tsx), 164 lines) does exactly
two things: a users table (role change + password reset) and an approve/reject list of *pending*
custom content. It cannot see approved content, cannot see characters at all, and has no search,
filter or bulk action.

**The headline finding: write authorization is already admin-aware everywhere.** Every mutation
path already has an explicit admin bypass —
[`requireCharacterOwnerOrDM`](backend/src/middleware/character.ts) ("a global admin can act on any
character, owned or attached anywhere"), `requireCharacterOwner`, `requireCharacterViewable`,
[`requireCustomContentOwnerOrAdmin`](backend/src/middleware/customContent.ts), and
`redactPrivateNotesIfNotOwner` ("a global admin is a deliberate exception"). An admin can already
open, edit and delete any character or content item **if they can get its id**. So this theme is
almost entirely a *read/enumeration* problem plus UI, not an authorization rewrite — much smaller
than "manage everything" sounds.

**Cross-cutting trap — do not widen `listVisibleCustomContent`.** The tempting one-liner is to make
[that function](backend/src/services/customContent.service.ts) return everything when the caller is
an admin. It feeds the *player-facing pickers* (spell/feat/race lists on the sheet and in the
wizard), so widening it would fill an admin's own character sheets with everyone else's unapproved
drafts. The admin's management list and the admin's picker feed are different concerns: add a
separate endpoint, leave the existing function alone.

**Second trap — don't ship full payloads in list endpoints.** `Character.sheetData` is a whole 5e
sheet and `CustomContent.data` is a whole class/monster blob. A 200-row admin list must not carry
200 of either (payload size, and `sheetData` contains the `privateNotes` field that only exists to
be redacted). Both list endpoints return lean summary shapes; the manager and sheet keep fetching
full single items the way they already do.

**Decisions taken (all by the user):** all four optional capabilities are in scope (revoke
approval, reassign character owner, bulk select+act, delete users); admin content editing **reuses
CustomContentManager** rather than duplicating its ~9 type-specific editors; layout is **tabbed**;
user deletion **blocks when the user still owns anything** rather than cascading or reassigning.

128. ✅ **Admin enumeration endpoints — the actual gap.** No `listAllCharacters()` or
    `listAllCustomContent()` exists; `listCharactersForOwner`/`listCharactersForCampaign` are the
    only character list functions, and `listVisibleCustomContent(userId)` is approved-plus-own-pending.
    - **Add** `listAllCustomContent()` and `listAllCharacters()` services + `GET /api/admin/content`
      and `GET /api/admin/characters` on the existing `requireAuth, requireAdmin`-gated admin router.
    - **Lean summary shapes** per the trap above: `AdminCharacterSummary` (id, name, owner, campaign,
      system, level, status, updatedAt) and `AdminContentSummary` (`CustomContent` minus `data`).
      New types in `shared`, so the frontend isn't casting.
    - Leave `listVisibleCustomContent` untouched.

129. ✅ **Tabbed portal shell.** Restructure AdminPanel.tsx into Users / Custom content / Characters
    tabs, each with its own search box and filter row; widen past the current 700px column.
    - Tab state is local (no routing change) — `App.tsx` has one `{ name: "admin" }` view and adding
      per-tab URLs would mean touching its hand-rolled view union for no user-visible gain.
    - Extract the existing users table into its own tab component; it stays as-is functionally
      except for the delete button #135 adds.

130. ✅ **Custom content tab.** All items (not just pending), with owner / type / system / status
    columns, filter by status+type+system+owner, free-text name search, and per-row approve /
    revoke / delete.
    - **Bulk select + act:** checkboxes with bulk approve/revoke/delete, sized for the case that
      motivated it — approving a 40-item pack imported via #123 one click at a time is untenable.
    - Bulk actions reuse the existing single-item routes in a loop rather than new bulk endpoints,
      matching how #123's importer reuses `dataSchemaFor()` per row; partial failure reports
      per-row the same way the import result list does.

131. ✅ **Revoke approval (approved → pending).** Approval is one-way today (`approveCustomContent`
    sets status/approvedByUserId/approvedAt; nothing sets them back), so the only way to un-publish
    a bad item is to delete it and destroy the author's work.
    - **Route:** `POST /api/custom-content/:id/unapprove`, admin-only, clearing
      `approvedByUserId`/`approvedAt` alongside the status flip.
    - **Known consequence to surface in the UI, not paper over:** a character that already
      references the item as `custom-${id}` (spell `srdId`, background `grantedFeats`, race trait
      granted spells) will stop resolving for everyone except the author once it leaves `approved`,
      and will render as a bare name. Revoking is the right tool for "this shouldn't be public
      yet", not for "this is wrong" — the confirm dialog should say so.

132. ✅ **Character tab.** All characters with owner / campaign / system / level / status columns,
    filter by owner+campaign+system+status, name search.
    - Per-row: open sheet (already fully functional for admins — `requireCharacterOwnerOrDM` and
      the sheet's own admin exceptions mean **no sheet-side work at all**, this is purely a
      navigation entry point), detach from campaign, delete.
    - Bulk delete, same partial-failure reporting as #130.

133. ✅ **Reassign character owner.** Genuinely new — nothing in the codebase currently writes
    `characters.ownerUserId` after creation.
    - **Route:** `PATCH /api/admin/characters/:id/owner` taking a target userId.
    - **Edge case that needs a deliberate answer:** if the character is attached to a campaign the
      new owner isn't a member of, the character would be owned by a non-member. Detach on
      reassignment (simplest, and the admin can re-attach) rather than silently auto-joining
      someone to a campaign — matching #123's refusal to let an import silently touch content its
      caller doesn't own.

134. ✅ **Make CustomContentManager admin-aware.** So admins can *edit* other people's content
    without duplicating ~2400 lines of type-specific editors (the chosen approach).
    - When `user.role === "admin"`, its "My items" list is fed by the #128 admin endpoint instead
      of `listCustomContent()`, gains an owner column, and retitles ("All items"). Every existing
      per-type editor, the `startEdit` parse path and the save path are reused unchanged —
      `PATCH /:id` already allows admins via `requireCustomContentOwnerOrAdmin`.
    - The admin portal's content tab links here for edit rather than embedding a second editor.

135. ✅ **Delete users, with an ownership guard.** Users can currently only have their role/password
    changed, never be removed.
    - **Blocked, not cascading** (the user's call): `foreign_keys = ON` is set in
      [client.ts](backend/src/db/client.ts) and **6 of the 8 FKs to `users.id` are NOT NULL** —
      `campaigns.ownerUserId`, `campaignMemberships.userId`, `characters.ownerUserId`,
      `diceRolls.userId`, `notes.authorUserId`, `customContent.createdByUserId` (only
      `encounters.ownerUserId` and `customContent.approvedByUserId` are nullable). A bare DELETE
      therefore fails at the DB with an opaque constraint error → 500.
    - **So:** count dependants first and return **409 with a breakdown** ("3 characters, 1 campaign,
      12 content items, 40 dice rolls") so the admin reassigns (#133) or deletes those first.
      Nothing is ever destroyed implicitly.
    - **Two guards beyond that:** an admin can't delete their own account (same reasoning as the
      existing self-role-change block in AdminPanel.tsx), and can't delete the **last** remaining
      admin — that would leave the install with no way to reach this portal at all.
    - Dice rolls and notes are the awkward part of the breakdown (nobody wants to hand-delete 40
      rolls to remove a departed player). Worth revisiting whether those two specifically should
      cascade, once the guard exists and the real numbers are visible.

**Verified (#128-135, done):** the headline finding from the plan held up exactly as predicted --
every mutation route already had an admin bypass (`requireCharacterOwnerOrDM`,
`requireCustomContentOwnerOrAdmin`, `redactPrivateNotesIfNotOwner`), so this theme really was almost
entirely enumeration + UI, not an authorization rewrite. Added `listAllCustomContent()` /
`listAllCharacters()` (lean `AdminContentSummary`/`AdminCharacterSummary` shapes, no `data`/
`sheetData`) alongside the existing `listVisibleCustomContent`/`listCharactersForOwner` -- the
latter two are untouched, so the player-facing pickers still only ever see approved-plus-own-pending,
per the plan's first trap. Also added a `GET /api/custom-content/:id` single-item route that turned
out to be missing entirely -- needed so `CustomContentManager`'s new admin "All items" list (fed by
the lean summary) can fetch a clicked row's full `data` before opening the editor.

`unapproveCustomContent()` mirrors `approveCustomContent()` exactly (clears
status/approvedByUserId/approvedAt); `reassignCharacterOwner()` detaches from the campaign when the
new owner isn't a member, reusing `getMembership()` rather than duplicating that check; user delete
counts six dependant tables up front (`countUserDependants`) and returns 409 with the full breakdown
via a new `UserHasDependantsError` on the frontend, plus self-delete and last-remaining-admin guards
(the latter is unreachable in practice given the former -- an admin can never be both the actor and
the sole target of their own delete call -- but cheap to keep as documented intent). `AdminPanel.tsx`
is now three tabs (Users/Custom content/Characters) with search+filter+bulk-select on the latter two,
bulk actions looping the existing single-item routes with per-action partial-success counts (same
reuse #123's importer makes). `CustomContentManager` gained an `editContentId` prop so the content
tab's Edit button navigates straight into the real per-type editor instead of duplicating one.

Live-verified extensively via a mix of browser UI and direct `fetch()` (native `window.confirm()`
dialogs reliably hung the browser-automation tool this session, as they had earlier for character
deletion -- confirmed a harness limitation, not an app bug, by re-testing the identical code paths
via `fetch()`, which never touches `confirm()`): tabbed shell renders correct live counts (11 users,
7 content, 12 characters); delete-user returned the exact dependant breakdown for a user owning
campaigns/dice-rolls/notes (`409`, `{campaignsOwned:1, diceRolls:105, notes:4, ...}`) and correctly
blocked self-delete (`400`); the content tab's "All items" table showed every user's items including
other people's pending drafts, and clicking Edit on someone else's class navigated into
`CustomContentManager`, auto-opened the real editor, and every field (hit die, caster type, level
rows, the Infusions resource) came back exactly as authored; "← Back" from there returned to the
admin panel, not home; approve/unapprove round-tripped status and cleared/set
approvedByUserId+approvedAt correctly; character reassignment worked both when the new owner *was*
already a campaign member (stayed attached) and when they *weren't* (correctly detached,
`campaignId: null`), verified by checking real campaign-membership rows before asserting. Full build
across all three workspaces clean throughout; 21 backend tests green. All test users/roles/data
restored to their pre-verification state afterward.

## Theme: visual dice rolling

Every roll in the app currently surfaces as a text string — `roll.breakdown`, e.g.
`1d20+5: [9]+5 = 14` — pasted inline wherever the roll happened. The ask: a popup showing the
die face itself, the bonuses below it, and the total.

**Rolling is and stays server-side.** [lib/dice.ts](backend/src/lib/dice.ts) validates against
`DICE_FORMULA_PATTERN` and the comment in [schemas.ts](shared/src/schemas.ts) is explicit that the
charset restriction is "defense-in-depth against the underlying expression evaluator, on top of it
always running server-side". Nothing here moves rolling to the client for animation's sake — the
client animates a result the server already decided.

**The data is recoverable, but from two places.** `new DiceRoll(f).toJSON().rolls` gives per-die
`value`, plus `useInTotal: false` and `modifiers: ["drop"]` on dice a modifier discarded (`4d6kh3`).
What it does **not** carry is the die *size* — there is no `sides` anywhere in that JSON, so it
cannot tell a d20 from a d6. `Parser.parse(notation)` does carry `{ sides, qty }` per term. The two
arrays are positionally aligned (same expression structure, verified against `1d20+5`, `2d6+3`,
`4d6kh3`, `8d6+2d6`), so the backend zips them into one structured shape. Reconstructing this by
parsing the `breakdown` string instead would be fragile — `[4, 1d, 6, 1]` encodes a dropped die as a
`d` suffix — and would duplicate logic the roller already has.

**Cross-cutting trap — "every roll" only works if the modal is a *session*, not a dialog.** There
are **18 `createRoll` call sites** across 8 files, and they are not all single dramatic rolls:
[CharacterCreationWizard](frontend/src/pages/CharacterCreationWizard.tsx) fires `4d6kh3` six times in
a `for` loop; [EldritchBlastControl](frontend/src/components/systems/EldritchBlastControl.tsx) fires
attack+damage per beam (up to 6 rolls); [ArenaPage](frontend/src/pages/ArenaPage.tsx) rolls
initiative for both combatants back to back, and attack+damage per exchange;
[AttackRollControl](frontend/src/components/systems/AttackRollControl.tsx) rolls an attack, waits for
the player to click Hit, then rolls damage plus one roll per active extra-damage effect. A
one-modal-per-roll design means six stacked dialogs in the wizard. So the modal is modelled as a
**roll session** that can hold several rolls and stay open across phases — which is what makes the
chosen "every roll, everywhere" scope viable rather than punishing.

**Second trap — `roll()` must still return its result.** Callers don't just display the breakdown;
they *branch* on it. Death saves read `roll.total` to detect nat 20/nat 1 and mutate the sheet, the
wizard collects six totals into its assignable `pool`, Arena applies damage to combatant HP, short
rest healing adds to HP. The session API therefore resolves with the roll exactly as
`diceApi.createRoll` does today — the modal is a *side effect* of rolling, never a replacement for
the return value. This is what keeps an 18-site migration safe.

**Decisions taken (all by the user):** scope is **every roll, everywhere** (hence the session
design above); structured detail is **returned and persisted** (new column + migration), so history
rows and socket-broadcast rolls carry it too; spectators in a campaign get **no popup** — the
existing dice-log line only, so a dialog never steals focus mid-turn; and all four extras are in
scope — nat 20/nat 1 highlighting, `prefers-reduced-motion`, a compact layout for many dice, and a
reroll button.

136. ✅ **Structured roll detail — shared shape, backend, migration.** The plumbing everything else
    needs. Today `DiceRoll` ([types.ts](shared/src/types.ts)) and the `dice_rolls` table carry only
    `total` + `breakdown: string`.
    - **Shape:** `RollDetail { terms: RollTerm[]; total: number }`, where a term is one of
      `{ kind: "dice", sides, dice: { value, kept }[], subtotal }`, `{ kind: "constant", value }`, or
      `{ kind: "operator", op }`. `kept: false` is the `useInTotal: false` case (a dropped `4d6kh3`
      die), rendered struck-through rather than hidden — seeing what was dropped is the point.
    - **Build it** in `rollDice()` by zipping `Parser.parse(formula)` (sides/qty) with
      `roll.toJSON().rolls` (values/drops), per the finding above.
    - **Persist:** new nullable `detail` TEXT column (JSON) on `dice_rolls`, migration `0016`.
      Nullable, not defaulted — every pre-existing row genuinely has no detail, and
      `DiceRoll.detail: RollDetail | null` makes the renderer handle that explicitly rather than
      faking an empty roll. Old rows keep rendering as today's `breakdown` text.
    - `breakdown` stays exactly as-is. It's still the right thing for the dice log, the socket
      payload, and any future non-visual surface — this adds a channel, it doesn't replace one.

137. ✅ **`DiceRollModal` — the visual.** One presentational component, no roll logic of its own.
    - **Layout, matching the ask:** the die face(s) at the top, each bonus/term on its own line
      below, total at the bottom. Reuses the existing overlay convention from
      [FeatPickerModal.tsx](frontend/src/components/systems/FeatPickerModal.tsx)
      (`position: fixed; inset: 0; rgba(0,0,0,0.4); zIndex: 1000`) rather than inventing a second
      modal style.
    - **Die faces** as inline SVG per side count — a d20 gets the icosahedron silhouette, d4/d6/d8/
      d10/d12 their own shapes, anything else a generic polygon. Value centred on the face.
    - **Compact layout for many dice:** Meteor Swarm is `20d6` and upcasting stacks (`8d6+2d6`), so
      faces wrap and shrink past a threshold, falling back to a plain value list at the extreme.
      Designed up-front rather than discovered on a fireball.
    - **Motion:** a short tumble before settling, wrapped in
      `@media (prefers-reduced-motion: reduce)` that cuts straight to the result. The app has **no
      `@keyframes` and no reduced-motion handling anywhere today** — this is the first, so it sets
      the convention.
    - **Reroll button** re-runs the same formula and replaces the result in place.

138. ✅ **Roll session context — what makes "every roll" workable.** A `DiceRollProvider` +
    `useDiceRoll()` hook wrapping the app.
    - **API:** `roll(campaignId, formula, label)` — same signature and same resolved value as
      today's `diceApi.createRoll`, so call sites keep working (see the second trap above) — plus
      `session(label, fn)` which opens one modal and collects every `roll()` inside `fn` into it.
    - The wizard's six ability scores, Eldritch Blast's beams, and Arena's two initiative rolls each
      become **one** modal with several die groups, not six modals.
    - Spectators are unaffected: this is client-local state on the roller's machine. The
      `roll:created` socket broadcast and the dice log are untouched, per the chosen behaviour.

139. ✅ **Migrate the 18 call sites onto the session API.** Mostly mechanical, and a net *deletion* —
    a lot of per-component result state exists only to render breakdown strings that the modal now
    owns: `attackBreakdown`/`damageBreakdown`/`extraDamageResults` (AttackRollControl),
    `rollResults` (Dnd5eSheet), `rollDetails` (CharacterCreationWizard), and the equivalents in
    SpellCastControl/EldritchBlast/Arena/Familiar/WildShape.
    - Wrap the loop sites in `session(...)`: wizard ability scores, Eldritch Blast beams, Arena
      initiative, Arena attack+damage.
    - Leave `DiceRoller`'s log list alone — it's a chat history, not a roll result, and the chosen
      spectator behaviour keeps it as text.

140. ✅ **Multi-phase rolls inside one modal.** AttackRollControl's attack → Hit/Miss → damage → extra
    damage is a state machine (`Phase`) that currently renders four separate text lines.
    - The modal stays open across the whole sequence: attack die on top, **Hit/Miss buttons inside
      the modal**, then damage and each typed extra-damage line appended below on a Hit.
    - Preserves the existing `onHit` contract exactly — it fires once, after damage plus every
      extra resolves, and never on a Miss (Wrathful Smite's "if you don't hit... the spell isn't
      wasted" behaviour that #111 established).

141. ✅ **Nat 20 / nat 1 highlighting.** Crits are **not modelled anywhere today** — the only natural-
    value check in the codebase is `rollDeathSave` ([Dnd5eSheet.tsx](frontend/src/components/systems/Dnd5eSheet.tsx)),
    and it only works because that formula is a bare `1d20`, making `roll.total` coincidentally the
    natural die.
    - With #136's structure the natural die is addressable for *any* formula, so add a
      `naturalD20(detail)` helper (first kept die of the first d20 term) and colour the face
      green on 20 / red on 1 in the modal.
    - **Display only** in this pass — no crit damage doubling, no auto-doubling of dice. That's a
      rules change with real blast radius (which dice double, brutal critical, Champion's expanded
      crit range) and belongs in its own item if it's wanted.
    - Worth refactoring `rollDeathSave` onto the same helper so there's one definition of "natural
      d20" rather than two.

## Theme: critical hits

Extends #141, which deliberately stopped at colouring the die face. This is the rules half: a
natural 20 should actually change the damage roll.

**The whole mechanic is one pure function.** RAW (PHB 196): "Roll all of the attack's damage dice
twice and add them together. Then add any relevant modifiers as normal." So a crit doubles the
*dice* and leaves *flat modifiers* alone — `2d8+4` becomes `4d8+4`, **not** `4d8+8`. Everything
below hangs off a single `critFormula(formula)` transform that doubles every dice term's quantity
and passes constants through untouched.

**Two damage shapes exist, and one function covers both.** Sheet attacks keep them separate —
`attackSchema.damageDice` is pure dice (`"1d8"`) and the comment on `AttackRollControl`'s
`magicBonus` prop already says it is "everything added to the damage roll besides the dice"
(ability mod + magic + feat + buff flat). SRD monsters do the opposite: **482 of 553
`damageDice` values embed the flat modifier** (`"2d8+4"`, `"1d6+1"`), against only 71 that are pure
dice. A transform that doubles dice terms and ignores constants is correct for both without either
path needing to know which shape it holds — and it is also correct for a player who types `"1d8+3"`
into the sheet's free-text damage field, which nothing prevents today. Spell damage
(`scaledSpellDamage` → `"8d6+2d6"`) falls out of the same rule: `"16d6+4d6"`, all dice doubled.

**Cross-cutting trap — apply the transform to the dice string only, never to the flat bonus.**
Because the sheet passes `damageDice` and the flat total as *separate* arguments, it would be easy
to crit the assembled formula instead and silently double the ability modifier. The transform must
sit on `damageDice` at the point of construction, with the flat bonus appended afterwards exactly
as it is today.

**Half the data already exists and is merely displayed.** `brutalCriticalDice` is fully populated in
the Barbarian progression table ([class-progression.ts](shared/src/systems/class-progression.ts),
levels 9/13/17 → 1/2/3) *and* authorable on custom classes via `martialLevelEntrySchema` — but
`martialFeatureLines()` only ever renders it as the string `"Brutal Critical: +N dice"`. It has never
been applied to anything. By contrast **there is no crit-range concept anywhere**: Champion's
"Improved Critical" and "Superior Critical" are bare feature-name strings in
[srd-subclasses.ts](shared/src/systems/srd-subclasses.ts), and Half-Orc "Savage Attacks" is a bare
trait name in [srd-races.ts](shared/src/systems/srd-races.ts).

142. ✅ **`critFormula()` — the transform, with tests.** One pure function in `shared`, the foundation
    for everything below.
    - Doubles the quantity of each dice term, leaves constants and operators alone:
      `1d8` → `2d8`; `2d8+4` → `4d8+4`; `1d8+1d6` → `2d8+2d6`; `1d6+1` → `2d6+1`.
    - **Degrade safely, don't guess:** return the input unchanged for anything it can't confidently
      rewrite — an empty string, a bare constant (`"1"` is a real SRD monster `damageDice` value),
      or a term carrying a keep/drop modifier (`4d6kh3`), where doubling the quantity would change
      what the modifier selects. Damage formulas never use `kh`/`kl` today, but silently mangling
      one is worse than leaving it be.
    - **Tests:** `shared` currently has **no test runner at all** — only `backend` does
      (`tsx --test src/**/*.test.ts`). Add the same script to `shared` and put `crit.test.ts`
      beside the function. A pure string→string transform with this many edge cases is exactly what
      the repo's existing test setup is for, and every other item here trusts it.

143. ✅ **Crit threshold — detecting the crit.** Nothing models a crit range today.
    - **Sheet field:** `critThreshold: z.number().int().min(2).max(20).default(20)` on
      `dnd5eSheetSchema`, editable, so a house rule or an unmodelled feature can just set it.
    - **Derived suggestion,** matching how the sheet already suggests HP and spell slots rather than
      forcing them: Champion's "Improved Critical" (level 3) → 19, "Superior Critical" (15) → 18,
      matched off the existing SRD subclass feature-name strings. Custom subclasses get an optional
      `critThreshold` on `subclassFeatureSchema` so homebrew isn't stuck at 20.
    - A roll crits when the natural d20 (via #141's `naturalD20(detail)` helper — one definition,
      not two) is >= `critThreshold`.
    - **Out of scope:** Hexblade's Curse and Assassinate widen the crit range only against a
      *specific target*, and the app has no notion of a target. Noting it rather than half-building it.

144. ✅ **Extra crit dice — Brutal Critical and Savage Attacks.** Both add *extra* weapon dice on a
    crit rather than doubling anything, so they stack on top of #142's transform.
    - **Brutal Critical:** read the `brutalCriticalDice` already sitting in the progression entry
      (and in custom classes) instead of only printing it. Barbarian 9/13/17 → +1/+2/+3 dice of the
      weapon's own size, so the size is parsed from the first dice term of `damageDice`.
    - **Savage Attacks (Half-Orc):** +1 weapon die on a crit. #124 just turned race traits into rich
      objects, which gives this an obvious home — add `extraCritDice` to `raceTraitSchema` and set
      it on the SRD Half-Orc entry, rather than string-matching a trait name.
    - Applies to *weapon* damage only, never to the extra typed damage entries — Brutal Critical
      says "one additional weapon damage die", not one of everything.

145. ✅ **Wire it through the four damage paths, and handle nat 20 / nat 1 in the flow.**
    - `AttackRollControl` (sheet attacks, familiars, wild shape, bestiary), `SpellCastControl`
      (spell attack cantrips/spells), `EldritchBlastControl` (per beam — each beam crits
      independently), and `ArenaPage`.
    - **Behaviour change worth calling out:** today the modal always asks Hit or Miss, because the
      app can't know the target's AC. On a natural 20 RAW that question has only one answer — a crit
      always hits — and on a natural 1 an attack always misses. So the Hit/Miss prompt is replaced
      by "Critical hit!" / "Critical miss" on those two rolls, skipping a click that has no
      alternative. Every other roll keeps the existing prompt untouched.
    - The #137 modal labels the doubled roll as a crit and shows the doubled formula, so the player
      can see *why* the dice count jumped rather than just getting a bigger number.
    - `onHit` still fires exactly once after all damage resolves, preserving the #111 contract.

**Verified (#136-145, done):** the whole theme in one build. `buildRollDetail()` zips
`Parser.parse(formula)` (die size) with `roll.toJSON().rolls` (values) -- caught one real bug along
the way: the library's `.d.ts` types don't match its actual runtime JSON (`RollResults.toJSON()`'s
declared type omits the `type`/`rolls` fields the real output carries once something calls
`JSON.stringify` recursively), so the zip round-trips through a full `JSON.parse(JSON.stringify(...))`
rather than trusting live class-instance property reads. Migration `0016` adds a nullable `detail`
column with no default, so pre-#136 rows fall back to the plain `breakdown` text exactly as
designed. `critFormula()` shipped with its own test file -- `shared` had **no test runner at all**
before this, so `npm run test -w shared` (tsx --test) is new; 22 tests total across
`critFormula`/`critDamageFormula`/`naturalD20`/`isCriticalHit`/`isCriticalMiss`/`suggestedCritThreshold`.

`DiceRollProvider`'s `session()` is the one primitive everything else is sugar over -- a bare
`roll()` call is just `session(campaignId, label, (r) => r(formula, label))`. Each session carries
a uuid so a scoped-roll or `setSessionActions` call from a session that's since been replaced (the
player started a different roll before resolving this one's Hit/Miss) is a no-op instead of
corrupting whatever's currently showing. **Bug caught live, not in review:** the first crit test
showed the "Critical hit!" banner vanish instantly -- `rollDamagePhase()` unconditionally cleared
`sessionActions` at its own start (correct for the normal Hit-button-click path, which needs its
buttons to disappear) but that also wiped the banner the crit path had just set moments earlier.
Fixed by moving the clear into the Hit-button's own `onClick` and leaving `rollDamagePhase()` itself
silent on actions, so the crit banner persists through and after the damage roll. All 18 call sites
now route through `roll()`/`session()`; zero direct `diceApi.createRoll` calls remain outside
`DiceRollContext.tsx` itself.

Live-verified extensively in the browser: a manual `4d6kh3` roll in the plain DiceRoller correctly
showed the dropped die struck-through and greyed in the modal -- caught a real gap here too, the
first version only handled the "kept: false" styling in the compact-grid renderer, not the
individual-large-face renderer used for 2-4 dice, so a dropped die in exactly that range rendered
with no indication it was dropped; fixed by threading `kept` through `DieFace` itself (opacity,
grey fill/stroke, a struck-through line, `aria-label` suffixed ", dropped"). Created a level-5
Fighter with `critThreshold: 2` (crits on anything but a natural 1) specifically to make the crit
path deterministically testable rather than waiting on real 5% RNG: rolling its Longsword attack
(1d8+3, no extra crit dice) auto-skipped the Hit/Miss prompt, showed "Critical hit!", and rolled
`2d8` (doubled, flat +3 unchanged) for 13 damage, all in one modal, exactly matching PHB 196. The
character-creation wizard's six ability-score rolls landed as **one** modal with six accumulating
die groups and per-group totals correctly excluding the dropped die, matching the assignable pool
exactly. Arena's initiative pair rolled as one two-group session; an Arena attack with the same
character showed "CRITICAL HIT" in the text log, rolled `2d8` for damage, and applied it to the
target's HP (10 → 2) correctly overriding the normal vs-AC hit check. Full build across all three
workspaces clean throughout; 21 backend + 22 shared tests green. All test users/characters/rolls
cleaned up afterward.

## Theme: API tokens for scripted access

Prompted by "is there any way we can add API upload for custom content."

**First finding: the upload already exists and already works from outside the browser.** #123 built
`POST /api/custom-content/import`, and nothing about it is browser-specific. Proven end to end with
plain curl against the dev server -- register/login to a cookie jar, then POST a pack:

```
{"results":[{"index":0,"name":"Curl Test Feat","type":"feat","status":"created","id":32},
            {"index":1,"name":"Curl Test Spell","type":"spell","status":"created","id":33}]}
```

Per-row schema validation, `(type, name)` dedupe and partial-success reporting all work exactly as
they do from the UI. **So this theme is not about upload at all -- it's about authentication.** The
only thing making scripting awkward is that the sole way to authenticate is a password login plus a
session cookie: a script has to embed a real account password, and the session is a rolling 7-day
cookie that will eventually stop working.

**The bulk of the work is a refactor, not the tokens.** Auth is session-only today, and
**49 `req.session.userId` reads span 14 files** (every route group plus five middlewares). Token
auth means those all have to resolve a user identity that may not have come from a session.

**Cross-cutting trap #1 -- do not set `req.session.userId` from a token.** It's the tempting
zero-refactor shortcut: populate the session field in memory and all 49 call sites keep working
untouched. But mutating `req.session` marks it dirty, and `express-session` then *persists* it at
response end -- every scripted API call would write a junk row into the `sessions` table, growing
forever and polluting the same table real logins use. Hence a separate `req.authUserId`, and hence
the refactor.

**Cross-cutting trap #2 -- do not bcrypt the token.** Passwords get a deliberately slow KDF because
they're low-entropy and brute-forceable; a 256-bit CSPRNG token has nothing to brute-force, so
bcrypt would add ~100ms to *every* authenticated API request for no security gain. Worse, bcrypt is
salted per-row, so you couldn't look a token up by its hash at all -- you'd have to scan every token
row and compare one by one. A plain SHA-256 is deterministic, so the hash gets a unique index and
lookup stays a single indexed read. (Same reasoning GitHub/GitLab use for PATs.)

**Decisions taken (by the user):** tokens carry **full account access and inherit the owner's role**
-- the GitHub classic-PAT model -- rather than being scoped to custom content or having per-token
scope checkboxes. Simplest to build and flexible for scripting characters/campaigns later, with the
accepted trade-off that a leaked token is a full account compromise until revoked (**including admin
actions when the owner is an admin**). #146 leans on shown-once + `lastUsedAt` + one-click revoke to
make that trade-off manageable rather than invisible.

146. ✅ **Token storage, generation and lookup.** New `api_tokens` table + migration `0017`.
    - **Columns:** `id`, `userId` (FK), `name` (what it's for -- "content upload script"),
      `tokenHash` (**unique index**, the SHA-256 of the token), `prefix` (first few chars, shown in
      the list so a token is identifiable without storing it), `lastUsedAt` (nullable),
      `expiresAt` (nullable -- null means no expiry), `createdAt`.
    - **Format:** `rpgc_<32 random bytes, base64url>`. The `rpgc_` prefix makes a leaked token
      greppable in logs/repos and lets secret scanners recognise it.
    - **Shown exactly once**, at creation. Only the hash is stored, so it is genuinely
      unrecoverable afterwards -- the UI has to say so plainly.
    - **Revoke = delete the row.** No soft-delete: this is a self-hosted server, and a revoked
      token that still exists is just a thing to get wrong later.
    - `lastUsedAt` is written on use (best-effort, never blocking the request) so a stale or
      suspicious token is visible in the list.

147. ✅ **`resolveAuth` middleware, and the 49-site session-read refactor.** The security-sensitive
    half -- a *missed* call site is an auth bug, not a cosmetic one.
    - **`req.authUserId`** becomes the single source of "who is this request", set app-wide before
      the routers by a `resolveAuth` middleware: an `Authorization: Bearer rpgc_...` header when
      present (hash → indexed lookup → reject if unknown/expired), otherwise `req.session.userId`.
      `requireAuth`/`requireGlobalRole` read only `req.authUserId`.
    - **Completeness is compiler-enforced, not grep-enforced:** temporarily remove `userId` from the
      `express-session` `SessionData` declaration, which turns *every* remaining
      `req.session.userId` read into a type error, fix them all, then restore the declaration (login
      still writes it). Guarantees none of the 49 is missed, which a hand-audit or a sed could not.
    - **Verify afterwards** that `grep -rn "req.session.userId" backend/src` returns only the login
      write in `auth.routes.ts` and the session fallback inside `resolveAuth` itself.
    - **Websockets stay session-only, deliberately.** `createSocketServer` shares the express session
      middleware for live campaign updates; that's a browser feature, not a scripting one, and
      bearer auth over the WS upgrade is surface with no use case behind it.
    - **No rate limiting on token auth** (unlike login, which has IP + per-user limits): brute-forcing
      256 bits of entropy isn't a threat model, and a limiter here would only ever throttle a
      legitimate script.

148. ✅ **Token routes.** `GET/POST/DELETE /api/tokens`, session-authenticated only.
    - **A token cannot mint or list tokens.** Bearer-authenticated requests are rejected on this
      router specifically, so a leaked token can't quietly issue itself successors or enumerate the
      owner's other tokens -- the one place where "inherits your role" is deliberately not honoured,
      and the main thing that keeps revocation meaningful.
    - `POST` returns the plaintext token exactly once; `GET` returns name/prefix/lastUsedAt/expiry
      only. `DELETE` is scoped to the caller's own tokens (admins included -- there's no reason to
      manage someone else's tokens rather than disable the account).

149. ✅ **Token management UI + a copy-pasteable example.** A new "API tokens" panel on the home
    dashboard, alongside "My notes"/"My characters" -- per-user, so any DM who authors content can
    self-serve without an admin.
    - Create (name + optional expiry), list (name, prefix, last used, expiry), revoke.
    - **The new-token screen shows a ready-to-run `curl` for the import endpoint** with the real
      token already in it. The whole point of this theme is scripted uploads; making someone
      reconstruct the request from docs would waste the work. Doubles as the "copy it now, you
      cannot see it again" moment.

**Verified (#146-149, done):** the refactor landed exactly as planned -- temporarily renaming
`SessionData.userId` turned all 49 reads into compile errors, which is how every one was found
rather than trusting a grep. Afterwards `grep -rn "req.session.userId"` returns only the four
legitimate sites in `auth.routes.ts` (login/logout/session) plus `resolveAuth`'s own fallback read.

**Caught during the refactor, not in review:** the hardening integration test builds **four**
separate express apps, each wiring `express.json()` + `createSessionMiddleware()` + routers by hand
-- so all four silently 401'd everything the moment `requireAuth` started reading `req.authUserId`.
Fixing the four call sites was trivial, but the underlying footgun (assemble an app, forget one
middleware, every authenticated route fails as "not authenticated") would bite again. So
`requireAuth` now *throws* when `req.isTokenAuth === undefined` -- resolveAuth always sets it to a
boolean, so undefined can only mean the middleware never ran. Misconfiguration now says so instead
of masquerading as a bad password.

**Second thing the build surfaced:** `api_tokens.user_id` is a NOT NULL FK, making it the **7th of
9** blockers for #135's user delete. Without wiring it into `countUserDependants` a user whose only
remaining dependant was a token would have hit the exact opaque FK-constraint 500 that #135 exists
to prevent. Added to `AdminUserDependants` and the admin panel's breakdown; verified live -- a user
with nothing but one token returns `409 {"apiTokens":1}` rather than a 500.

Live-verified the whole flow with curl and in the browser: minted a token over a session, then used
it as the **only** credential (no cookie, no password) to POST a 2-item pack to
`/api/custom-content/import` -- both created. A bogus token 401s. **Trap #1 confirmed avoided:** ten
consecutive token-authed requests added **zero** rows to the `sessions` table, while `lastUsedAt`
updated correctly. A token forced past its expiry 401s and is deleted on sight. A revoked token
401s immediately. **The #148 carve-out holds:** a valid token attempting to mint a successor or list
its owner's tokens gets `403 "API tokens can't manage API tokens"` on both. In the UI, the panel
(DM/admin only) created a token, showed it once with copy buttons, and listed it as `rpgc_p2iR-7ZA…`
with no way to recover the full value -- and the generated example command, **run verbatim including
its origin**, successfully imported a feat. Full build across all three workspaces clean; 21 backend
+ 22 shared tests green. All test users/tokens/content cleaned up afterward.

## Theme: a real theming layer, and six themes on top of it

Prompted by "theming improvements to make it look like an old timey pen and paper theme," then widened
to several themes including a futuristic one. A mockup of three paper directions was built first
(Ledger / Vellum / Graph) and the direction confirmed off that.

**The blocker is that there is no theming layer at all.** `index.css` defines `--text`, `--bg`,
`--border`, `--accent` and even a `prefers-color-scheme: dark` block -- and **not one component reads
any of them**. Every surface is styled inline with literal values: **186 hardcoded colours across 38
components**, plus `crimson` as the de-facto error colour in **27** files. Editing the existing
variables today changes nothing on screen, so "add a theme" is really "add the layer, then add
themes."

**The 186 is not 186 decisions -- it collapses hard.** Counted rather than estimated:

| Pattern | Reality |
| --- | --- |
| `const box` panel style | duplicated across **7 files**, 5 of them byte-identical |
| `overlayStyle` + `dialogStyle` | duplicated across **6 modal files** |
| `crimson` | 27 files, already functioning as one error token |
| `#666` / `#555` / `#888` / `#777` | 93 uses -> one muted-text token |
| `#ccc` / `#ddd` / `#eee` / `#bbb` | 79 uses -> two border tokens (hairline + panel) |

So the vocabulary lands around a dozen tokens, and a large share of the work is *extracting shared
style objects that were already copy-pasted* -- a deduplication that's worth doing on its own merits
and happens to be the thing that makes theming possible.

**Cross-cutting trap #1 -- inline styles beat stylesheets, so the layer has to replace them, not
override them.** There's no CSS-specificity trick that lets a theme win against
`style={{ color: "#666" }}`; short of `!important` on every rule, the inline value always wins. The
tokens must be *substituted into* those style objects (`color: "var(--text-muted)"`), which is why
this is a refactor and not a stylesheet drop-in.

**Cross-cutting trap #2 -- the traditional sheet is a printable artifact, not a screen.** It already
carries its own 16 `--ts-*` tokens and an `@page` block. A dark or Console theme reaching print
means a solid black page and a drained cartridge. Decision below: it themes on screen, and print is
forced back to black-on-white regardless of theme.

**Trap #3 -- `index.css` and `App.css` are still largely Vite starter scaffolding.** `.hero`,
`#next-steps`, `#docs`, `.vite`, `.framework`, `.ticks`, `#spacer` are dead: nothing renders them.
`#root` also still carries the template's `text-align: center` and a fixed `1126px` width. Clearing
that out first means the theme layer isn't built on top of rules that fight it.

**Decisions taken (all by the user):** **six themes**; the selected theme is an **account setting**
(the app's first user preference of any kind); and the traditional sheet **follows the theme on
screen but always prints as paper**.

150. ✅ **Kill the dead starter CSS, then define the token vocabulary.** Groundwork -- nothing visual
    should change in this item.
    - Delete the unused Vite scaffold rules from `index.css`/`App.css` and the `#root` centring and
      fixed width that no longer serve the app.
    - **Define the tokens** on `:root`, named by *role* rather than by look, so a theme can't be
      described in terms of one specific palette: `--surface`, `--surface-raised`, `--surface-sunken`,
      `--text`, `--text-muted`, `--text-heading`, `--border`, `--border-strong`, `--accent`,
      `--accent-contrast`, `--danger`, `--success`, plus `--font-display` / `--font-body` /
      `--font-data` and a `--radius` (paper themes want ~1px, the current look wants 6px).
    - **Default theme reproduces today's appearance exactly.** That's the acceptance test for the
      whole refactor: with Default selected, the app should be pixel-identical to before, which is
      the only cheap way to prove a 38-file substitution changed nothing.

151. ✅ **Extract the duplicated style objects into one shared module.** The dedup that makes the rest
    tractable, and worth doing regardless of theming.
    - `const box` (7 files) becomes one exported `panel` style; `overlayStyle` + `dialogStyle`
      (6 modal files) become one exported pair. All of them read tokens.
    - Also folds in the `numInput`/`rowStyle` variants that repeat across sheets.
    - Mechanical, and it shrinks the surface the next item has to touch.

152. ✅ **Substitute tokens for the remaining hardcoded values.** The bulk edit, ~38 files.
    - Greys map by role, not by value: `#666`/`#555`/`#888`/`#777` -> `--text-muted`;
      `#ccc`/`#ddd`/`#eee` -> `--border`; `#bbb` -> `--border-strong`; `crimson` -> `--danger`;
      `green`/`#1f6e1f` -> `--success`.
    - **Verify by diffing rendered output, not by reading the diff.** With Default selected, walk
      the main surfaces (home, sheet, custom content manager, admin panel, dice modal, bestiary,
      arena) and confirm nothing moved or changed colour. A missed literal is invisible in Default
      and only shows up as a stubborn light-grey border once a dark theme is on -- so this pass is
      what makes the later themes trustworthy.
    - The dice modal (#137) is a useful canary: it's recent, self-contained, and uses semantic
      colour (nat 20 green / nat 1 red) that must survive theming without becoming unreadable on a
      dark ground.

153. ✅ **The six themes.** Each is one block of token overrides -- no component changes.
    - **Default** — today's look, unchanged. Ships selected so nobody is surprised by an upgrade.
    - **Ledger** — ruled off-white, oxblood for pending/corrections, ink blue for approvals.
    - **Vellum** — aged warm paper, umber and moss; the heaviest of the paper set.
    - **Graph** — blueprint white with a 16px CSS grid, plan blue, pencil brown.
    - **Console** — the futuristic one: dark slate ground, phosphor accent, monospace `--font-data`,
      square `--radius`. This is the theme that will surface every missed literal from #152.
    - **High contrast** — near-black on white, heavy borders, no decorative tint. Held to a real
      WCAG AA check on body text and on the semantic colours, not eyeballed.
    - Every theme sets all tokens; none inherits half a palette from Default.

154. ✅ **Theme as an account setting.** The app's first user preference -- worth building as a pattern,
    not a one-off.
    - Nullable `theme` column on `users` + migration `0018`; `GET /api/auth/session` returns it and a
      `PATCH /api/auth/preferences` sets it. Null means Default, so existing rows need no backfill.
    - **Mirrored into `localStorage` and applied before first paint**, so the correct theme is on the
      document before the session request resolves -- otherwise every load flashes Default first.
      The account value stays authoritative and overwrites the cache when it arrives.
    - Picker lives in the same home-dashboard column as the API tokens panel (#149), visible to
      everyone rather than DM/admin-gated -- a theme is nobody else's business.
    - The next preference (the dice-modal opt-out considered and deferred during #139) should reuse
      this endpoint rather than inventing a second one.

155. ✅ **Print stays paper, whatever the theme.** Closes trap #2.
    - A `@media print` block pins the traditional sheet's `--ts-*` tokens back to black-on-white and
      neutralises any themed `--surface`/`--text` that would otherwise reach the page.
    - **Verify via actual print preview** on the Console theme specifically -- the failure being
      guarded against (a page of solid dark ink) is exactly the kind that looks fine on screen and
      is only visible in preview.

**Verified (#150-155, done):** the acceptance test held -- with Default selected the app reports the
original values exactly (`--text: #6b6375`, 18px root, white ground, `--radius: 6px`, and **no
`data-theme` attribute at all**, since Default *is* the `:root` block rather than a seventh copy of
the palette). After the substitution, `grep` for a hardcoded colour in any style context across all
`.tsx` returns **nothing** -- the only literals left are ThemePicker's swatches, which are literal by
necessity: a swatch has to preview a theme that isn't currently applied, so it can't read live tokens.

**Two corrections to the plan, made against reality rather than assumption.** First, the plan said to
delete `#root`'s centring and fixed width as scaffold -- but they, along with the `p`/`code`/`h1`
rules, are *live* and do affect the current layout. Only the class-based scaffold (`.hero`,
`#next-steps`, `#docs`, `.ticks`, `#spacer`, `.counter`) was genuinely dead, plus `App.css` in its
entirety, which turned out to be imported by nothing at all. Deleting what the plan claimed would
have broken the pixel-identical criterion the same item depends on. Second, the greys collapse was
described as ~12 tokens; the real vocabulary needed a `--warning`/`--warning-bg` pair that no
existing role covered (the amber "(homebrew)" markers and the sheet's level-up banner), found only
by sweeping for stragglers after the main pass.

**Console did its job as the canary.** Auditing every rendered element for a light background or
border while Console is active -- the only reliable way to find a missed literal, since one is
invisible under Default -- returned **0 offenders across 984 elements** on the character sheet
(the file that carried 39 literals) and 0 on the dice modal, whose die faces, dialog and semantic
crit colours all themed correctly.

**One real accessibility failure caught by measuring rather than eyeballing:** Graph's muted text
came in at **4.35:1**, just under the 4.5 AA threshold. Darkened to 5.18:1. Final measured contrast
against each theme's own ground -- body / muted / danger / success / accent all clear AA on all six:
Ledger 15.5/5.2/7.4/9.6/7.4, Vellum 12.0/4.6/5.9/6.7/6.7, Graph 12.0/5.2/6.3/6.1/6.6,
Console 12.2/6.0/6.6/10.9/11.2, High contrast 21.0/7.0/7.2/6.6/7.8.

**Known and deliberate:** `--text-dim` (tertiary text -- "never", "No tokens yet") sits at 3.1-3.8:1
on the five decorative themes. That is not a regression: Default's original `#888` was 3.54:1, so
this is a pre-existing shortfall carried forward rather than introduced, and raising it on Default
would break the pixel-identical criterion. The High contrast theme resolves it properly (7.0:1),
which is what that theme exists for.

Persistence verified end to end: choosing Console wrote `theme: "console"` to the account *and* the
`rpgc-theme` localStorage key, and the theme survived a full navigation via the pre-paint
`applyTheme(cachedTheme())` in `main.tsx` -- without which every load paints Default first and
visibly snaps. Print guard confirmed parsed and live: with Console active, the `@media print` block
still pins `--surface`/`--ts-fill` to white and forces `body { background: #fff !important }`, so the
printable character sheet cannot come out as a page of solid dark ink. Full build clean across all
three workspaces; 21 backend + 22 shared tests green; test user and character cleaned up.

## Theme: starting equipment — choices at creation, and gear that actually works

Prompted by the Rogue's starting equipment: "(a) a rapier or (b) a shortsword / (a) a shortbow and
quiver of 20 arrows or (b) a shortsword / (a) a burglar's pack, (b) a dungeoneer's pack, or (c) an
explorer's pack / Leather armor, two daggers, and thieves' tools" -- wanted in the wizard, authorable
for custom classes, and with the resulting gear equippable and able to produce attacks.

**Class starting equipment is not modeled anywhere.** `ClassProficiencies`
([srd-class-proficiencies.ts](shared/src/systems/srd-class-proficiencies.ts)) carries saving throws,
armor/weapon/tool proficiencies and skill choices -- no equipment. There's no schema for it and no
data, on SRD classes or custom ones. This is the bulk of the theme.

**The good news: half of "produce attacks" already exists.** The inventory's per-row **"Add to
Attacks"** button ([Dnd5eSheet.tsx](frontend/src/components/systems/Dnd5eSheet.tsx)) already resolves
an item's name against `findSrdWeapon`, picks the RAW-correct default ability via
`weaponDefaultAbility` (ranged -> DEX, finesse -> better of STR/DEX, else STR), and fills in damage
dice and type -- falling back to a custom weapon item when the name isn't SRD. Nothing new is needed
to *generate* an attack; what's missing is that granted equipment never reaches it.

**Cross-cutting trap -- granted items arrive inert, and would stay inert.** `backgroundGrants()`
([CharacterCreationWizard.tsx](frontend/src/pages/CharacterCreationWizard.tsx)) maps background
equipment to `{ name, quantity: 1, weight: 0, equipped: false, ... }` -- a bare string with no SRD
linkage, no real weight, and no `armor` sub-object. Class equipment naively added the same way would
look right and do nothing: no encumbrance, no AC from armor, and `findSrdWeapon` never consulted.
**Resolution against the SRD tables is the feature**, not the list of names. Worth fixing the
background path in the same pass rather than leaving two grant paths with different fidelity.

**Two data gaps found by checking rather than assuming.** Packs exist in `SRD_GEAR` as *empty
shells* -- `{ id: "burglars-pack", name: "Burglar's Pack", cost: "16 gp", weight: 0 }` with no
contents at all, so "a burglar's pack" is one weightless line. And `SRD_GEAR` has **116 entries and
no tools category whatsoever**: no Thieves' Tools (which the Rogue list requires), no artisan's
tools, gaming sets or instruments. Several existing backgrounds already grant tool *proficiencies*
with no matching item to hold.

**Decisions taken (all by the user):** packs **expand into their real contents**; the wizard
**auto-equips armor and auto-creates weapon attacks**; and the **whole missing tools category** gets
backfilled, not just the one item the Rogue needs.

156. ✅ **Backfill the missing SRD gear: tools, and pack contents.** Pure data, and everything else
    depends on it.
    - **Tools:** thieves' tools, all artisan's tools, gaming sets, musical instruments, plus the
      navigator's/disguise/forgery-style kits not already present. SRD 5.1 is CC-BY and ships
      in-repo, same precedent as `srd-spell-scaling.ts` and #125's monster backfill.
    - **Pack contents:** a `contents: { itemId, quantity }[]` on the seven pack entries, referencing
      existing `SRD_GEAR` ids so a pack is defined in terms of real items rather than duplicating
      their weights. Packs keep their own `cost`; the aggregate weight becomes derivable.
    - **Verify by resolution, not by eye:** every id referenced by a pack must resolve in
      `SRD_GEAR`, and every item named by #157's class lists must resolve in weapons/armor/gear.
      A typo'd id here silently produces an empty pack later.

157. ✅ **Model starting equipment, and backfill all 12 SRD classes.**
    - **Shape:** `{ choices: EquipmentChoice[]; fixed: EquipmentEntry[] }`, where a choice is
      `{ options: { label, items: EquipmentEntry[] }[] }` and an entry is
      `{ itemId, quantity }`. That covers the Rogue's three either/or slots plus its fixed
      leather/daggers/tools, and "a shortbow **and** quiver of 20 arrows" falls out of one option
      carrying two entries rather than needing a special case.
    - **Quantities are entries, not text:** "two daggers" is `{ itemId: "dagger", quantity: 2 }` and
      "quiver of 20 arrows" is `{ itemId: "arrow", quantity: 20 }`, so the inventory shows a real
      count instead of a name that happens to contain a number.
    - Backfill all 12 SRD classes rather than only Rogue -- it's bounded data entry, and a wizard
      that offers choices for one class and nothing for the other eleven is worse than none.

158. ✅ **Custom classes can author the same thing.** Parity, so homebrew isn't a second-class citizen.
    - `startingEquipment` on `customClassDataSchema`, reusing #157's exact shape.
    - Manager UI: repeatable choice rows (each with 2-3 labelled options) plus a fixed-items list,
      following the established repeatable-row convention (#124's trait cards, #105's resources).
    - Item references autocomplete against SRD weapons/armor/gear **plus visible custom items**,
      reusing the `visibleX` + unresolved-name-warning pattern #109/#126 established for spells and
      feats -- a custom class pointing at a deleted custom item should say so, not silently grant
      nothing.

159. ✅ **Resolve granted equipment into real inventory items.** The trap above, closed.
    - One shared `resolveEquipmentEntry(itemId, quantity)` in `shared`, used by both the class and
      background grant paths: looks the id up across weapons/armor/gear, and returns an inventory
      item with real `weight`, `value` parsed from `cost`, and -- for armor -- the `armor`
      sub-object that `effectiveAC()` needs.
    - **Also fix `backgroundGrants()`** to route through it, so background equipment stops being
      weightless text. Its `equipment.items` is `string[]` of free text, so resolution is
      best-effort by name with an unresolved entry falling back to today's plain-name item rather
      than being dropped.
    - Packs expand here, into their #156 contents.

160. ✅ **The wizard's equipment step.** A new step between Basics and Abilities.
    - One radio group per choice slot, labelled from the SRD text ("a rapier" / "a shortsword"), a
      read-only list of the fixed items, and a running total weight so the encumbrance implication
      of an explorer's pack is visible before committing.
    - Gated like the existing background/class choice completeness checks -- can't continue with an
      unanswered slot, matching how `backgroundChoicesComplete` already blocks the Basics step.
    - Skipped entirely for classes with no starting equipment defined (custom classes that didn't
      author any), rather than showing an empty step.

161. ✅ **Auto-equip armor and auto-create weapon attacks.** What makes the gear actually work.
    - Armor and shields arrive `equipped: true`, so a new Rogue's AC is right immediately rather
      than reading 10 until someone finds the checkbox.
    - Every granted weapon gets an Attacks row, built by **extracting the existing "Add to Attacks"
      resolution into a shared helper** and calling it -- not a parallel implementation that would
      drift from the finesse/ranged ability rules already encoded there.
    - **Ammunition is not a weapon:** arrows resolve as gear with quantity 20 and must not generate
      an attack row of their own. The generator keys off the item resolving in `SRD_WEAPONS`, which
      excludes them naturally.
    - **Verify on a real Rogue end to end:** create one, confirm leather armor equipped and AC 11+
      DEX, Rapier and Shortbow both present in Attacks with DEX (finesse/ranged) and correct damage,
      20 arrows as a single quantity-20 row, thieves' tools present, and the chosen pack expanded.

**Verified (#156-161, done):** built a live Rogue through the actual wizard UI (browser-driven, not
a script) -- Class = Rogue with 4 class skills, Background = Acolyte, then the new **equipment step**
appeared automatically between Basics and Abilities, rendering exactly the SRD text the user quoted:
"You start with" (Leather Armor, Dagger ×2, Thieves' Tools) plus three radio choices. Picked Rapier /
Shortbow+Quiver+20 Arrows / Burglar's Pack; the step's own running weight read **85.5 lb**, and
`13 (fixed) + 2 (rapier) + 23 (shortbow+quiver+20 arrows) + 47.5 (pack contents) = 85.5` checks out
by hand. After character creation, the live `sheetData` showed: **Leather Armor `equipped: true`**
with the real `armor` sub-object (AC read **14 = 11 + Dex +3** on the sheet, not the pre-existing-bug
10); **Burglar's Pack expanded into its 14 real constituent items** (Backpack, Ball bearings, String,
Bell, Candle ×5, Crowbar, Hammer, Piton ×10, Lantern hooded, Oil flask ×2, Rations ×5, Tinderbox,
Waterskin, Rope hempen) with **no leftover opaque "Burglar's Pack" row**; **20 Arrows as one
quantity-20 row**, not twenty; and **Thieves' Tools** present. Attacks held exactly three rows --
Dagger, Rapier, Shortbow, all `ability: "dex"` (finesse picked DEX since the rolled Dex mod beat
Str; ranged is always DEX) with correct dice/type -- and critically **no attack row for the
Quiver or the 20 Arrows**, confirming the generator's "must resolve in `SRD_WEAPONS`" gate holds.

**A real bug caught only by testing #158 with an adversarial name, not a clean one.** The equipment-
choices textarea's `Label | item, item` format used `,` to separate items within an option -- but
**24 SRD weapon/gear names contain a literal comma** ("Crossbow, hand", "Hammer, sledge", "Pick,
miner's", "Mirror, steel", and 20 others). Typing `Crossbow | Crossbow, hand` silently shredded it
into two unresolvable fragments, "Crossbow" and "hand", both flagged by the unresolved-name warning
-- the exact kind of goal-post-shifted input a hand-picked "Rapier | Rapier" example would never
surface. Fixed by switching the intra-option separator to `;` (verified zero SRD name contains one)
across the parser, the unresolved-name check, and the reverse formatter used when loading a class
back into the editor. Re-verified with the same adversarial input through a full save → reload →
API-read round trip on a throwaway "Test Gunslinger" class: `"Crossbow, hand"` now resolves to
`crossbow-hand` correctly, while a genuinely fake name (`"Musket"`) still -- correctly -- shows the
red unresolved warning and persists as an inert fallback rather than silently vanishing.

**One extraction, reused rather than duplicated.** `weaponDefaultAbility` (RAW: ranged -> DEX,
finesse -> better of STR/DEX, else STR) moved out of `Dnd5eSheet.tsx`'s closure over `sheet` into a
pure function in `shared` taking raw ability scores -- the sheet's "Add to Attacks" button and the
wizard's creation-time attack generator now both call the identical function, so the two paths can
never drift the way two independent implementations eventually would.

All test data (character, custom class, throwaway user) deleted after verification; nothing left
behind in the dev database.

## Theme: closing the custom-content modeling gaps a real test pass found

A pass against the custom-content system (SRD magic items, spells, race traits, subclass
resources) found two classes of problem: **hard validation failures** where real published
content (Counterspell's casting time, Wildemount's 300ft darkvision, a magic item's full
category string) got rejected by limits sized for the benchmark case rather than the real
ceiling, and **silent modeling gaps** -- things that save but don't do what they claim: a
+1 weapon's bonus vanishes, a Cloak of Protection's save bonus has no field, a race trait
authored through the UI can never carry the AC/attack/damage bonuses its own schema already
supports (only direct API/JSON import could reach them).

162. ✅ **Constraint bumps.** `castingTime` 60→120 (Counterspell's reaction trigger alone is
    88 chars), `darkvisionFeet` 120→300 on *both* `raceTraitSchema` and the sheet's own
    `dnd5eSheetSchema` (missing the second lets content validate but fail to seed onto a
    character), item `category` 30→60 ("Wondrous item (requires attunement by a
    spellcaster)" is 48 chars), background `equipment.items` line 100→200.

163. ✅ **A flat `saveBonus` vocabulary, matching `acBonus`'s existing shape.** Added to
    `effectBonusesSchema` (covers feats/background features/subclass features/race traits
    for free, since they all extend it), `effectEntrySchema` and `inventoryItemSchema`
    (`dnd5e.ts`), and `customItemDataSchema`. New `equippedItemBonus(sheet, key)` in
    `dnd5e.ts` generalizes the inline reduce `effectiveAC()` already did for `acBonus`;
    `saveBonus()` now folds in `featBonusTotal(sheet, "saveBonus")` and
    `equippedItemBonus(sheet, "saveBonus")` the same way AC does. Also added
    `magicBonus` (a weapon's flat +X, seeded into a generated attack row's existing
    `magicBonus` field rather than inventing a parallel bonus channel) and
    `requiresAttunement` to `customItemDataSchema` -- SRD magic item data has no attunement
    info at all, so a custom item was the only source that *could* carry it, and didn't.

164. ✅ **Trait editor UI parity + a warning for name-only traits.** The reported UI/schema
    mismatch: `raceTraitSchema` extends `effectBonusesSchema`, but `TraitRow` in
    `CustomContentManager.tsx` had none of those fields -- a trait like Warforged's
    Integrated Protection could only be authored via direct API import, and
    `traitRowsToData` was hard-zeroing every bonus field on save even before this, silently
    discarding anything a JSON import route *did* set. Added the full bonus field set
    (mirroring `SubclassFeatureRow`'s existing tuple-mapped UI pattern) plus a red warning
    line when a trait has a name but every mechanical field is still at its default --
    closing the "string trait silently became an empty shell" trap in the same pass.

**Verified (#162-164, done):** authored a custom race ("Test Warforged") with a trait
carrying `acBonus: 1` **through the actual form**, confirmed via direct API read that it
persisted (`"acBonus": 1`, not silently zeroed). Created a live Fighter with that race:
displayed **AC 19 (Chain Mail 16 + Shield +2)** -- the total correctly includes the trait's
+1 even though the breakdown text doesn't itemize it, confirming `effectiveAC()`'s
`featBonusTotal` pickup works end to end from a UI-authored trait, not just a hand-crafted
JSON payload. The new "Save" input rendered correctly on inventory item rows, the feat and
feature "Bonuses:" blocks, and the trait editor itself. `tsc -b` across `shared` + `frontend`
+ `backend` came back clean, and both existing test suites (`npm test -w shared`,
`npm test -w backend`, 22 + 21 passing) still pass. Test race, character, and throwaway user
deleted after verification.

165. ✅ **Resource `uses` scaling (proficiency bonus / ability modifier).** `homebrewResourceSchema`
    was fixed-int-only by original design -- real current-edition mechanics scale this way
    (2024 Bardic Inspiration = Charisma modifier uses, Second Wind scales with level). Added
    `usesFormula` ("fixed" / "proficiencyBonus" / "abilityModifier") and `usesAbility`;
    `resourceMaxUses(sheet, resource)` computes the real max live, floored at 1 for the
    ability-modifier case (a Charisma 8 Bard still gets at least 1 Bardic Inspiration, not a
    resource that's unusable by design). `homebrewResourcePools()` (and its
    `classResourcePools`/`subclassResourcePools` wrappers) now take the whole sheet instead
    of just `level`, since ability-modifier scaling needs `effectiveAbilityScore()`.

**Verified (#165, done):** JSON-imported a class with a Charisma-scaled resource, confirmed
the manager's **Edit** form round-tripped it correctly -- "= Ability modifier" selected with
a "Charisma (min 1)" dropdown shown, exactly matching what was authored. Directly exercised
`resourceMaxUses()` against the built package: fixed uses (3) unchanged, proficiency bonus
at level 5 correctly returns 3, ability modifier at CHA 16 correctly returns 3, and a low
STR-10 (+0 mod) case correctly floors at 1 rather than 0. `tsc -b` clean across all three
packages; both test suites still pass. Test class and throwaway user deleted after
verification.

166. ✅ **Magic item depth.** Toggleable effects (Flame Tongue's activatable +2d6 fire) reusing
    the existing `activeEffects` buff plumbing wholesale -- activating pushes an
    `item-toggle-${item.id}`-tagged entry, deactivating filters it back out, no changes needed
    to the aggregation functions that already sum `activeEffects`. The Activate button only
    renders once the item is actually equipped (and attuned, if required) -- Deactivate stays
    available regardless, so unequipping never strands an effect with no way left to clear it.
    Item-granted resistances (Dragon Scale Mail) via new `effectiveDamageResistances(sheet)`,
    mirroring `equippedItemBonus()`'s live-sum pattern; the sheet's Resistances field stays the
    manual/base list, with a read-only "Also from equipped items: ..." line for the rest.
    Bless's dice-based save bonus (`buffEffectSchema.saveDice`, previously only the attack-roll
    half was modeled) -- `rollCheck()`'s save-roll button now builds its 1d20 formula the way
    `AttackRollControl` already does, appending any active save-dice terms instead of just a
    flat bonus. Explicitly not included: conditional advantage (no advantage/disadvantage
    rolling primitive exists anywhere in the app yet -- foundational dice-engine work, its own
    pass).

**Verified (#166, done):** JSON-imported a Flame Tongue-alike (`toggledEffect: {damageDice:
"2d6", damageType:"fire"}`, `requiresAttunement: true`) and a Dragon Scale Mail-alike
(`grantedResistances: ["fire"]`), added both to a live character through the actual item-name
autocomplete, and confirmed via direct API read that both items picked up their full custom
data automatically (not just name/weight). Equipped + attuned the weapon: the Activate button
appeared (it hadn't before equipping), clicking it pushed exactly the expected entry into
`sheet.activeEffects` (`damageDice: "2d6", damageType: "fire"`), and the button flipped to
"Deactivate". Equipped the armor: AC breakdown showed "Test Dragon Scale 14 + Dex +0" and the
Resistances row showed "Also from equipped items: fire" live, with no change needed to the
underlying free-text field. Directly confirmed `SRD_SPELL_EFFECTS.bless` now carries
`saveDice: "1d4"` alongside its existing `attackDice: "1d4"`, and `hasBuffEffect()` correctly
distinguishes it from a no-op. `tsc -b` clean across all three packages; both test suites
still pass. Test items, character, and throwaway user deleted after verification.

167. ✅ **Combat modifiers.** A generic optional attack modifier (Sharpshooter/GWM-style -5/+10)
    and a generic ability-to-damage flag for homebrew feats/weapons -- note SRD's actual
    Agonizing Blast already works via its own dedicated `ebDamagePerBeamAbility` mechanism,
    this is about making the same *kind* of capability available outside that one hardcoded
    Eldritch Blast path. Both fields (`optionalAttackModifier`, `damageAbilityBonus`) landed
    as genuinely `.optional()` (no default) on `effectEntrySchema`/`customFeatDataSchema` --
    almost no feat has either, and making them required would have forced every feat/feature
    construction site in the codebase (a dozen-plus, per #163's own checklist) to specify "no
    tradeoff" explicitly. `AttackRollControl` renders one checkbox per available optional
    modifier (a character could in principle have more than one), summing whichever are
    checked into that specific roll only -- the penalty/bonus never applies unless chosen.
    `featDamageAbilityBonus(sheet)` folds into the existing damage-bonus computation next to
    `activeEffectDamageBonus`, no new prop needed for that half. Also fixed a gap #163 missed:
    the feat *authoring* form's save payload never included `saveBonus` at all (silently
    relying on the schema default), so a feat's save bonus could only ever be set via direct
    API/JSON import -- same UI/schema mismatch class as #164, just missed the first time.

**Verified (#167, done):** JSON-imported a feat with `optionalAttackModifier: {attackPenalty:
5, damageBonus: 10}` and `damageAbilityBonus: "cha"`, picked it on a live character (CHA 16,
+3 mod) through the actual Feat Picker, added an attack, and confirmed via the rendered page:
a checkbox reading "Test Sharpshooter (-5/+10)" appeared next to Roll (exact label/math from
the authored values), and the damage line read "Damage: 1d10 +3" -- the Charisma modifier
correctly folded in with no weapon-side changes needed. `tsc -b` clean across all three
packages; both test suites still pass. Test feat, character, and throwaway user deleted
after verification.

168. ✅ **Spell-grant semantics.** Magic Initiate's player-chosen class (the `"class"` spellChoice
    kind already existed and was already wired end-to-end -- `classId` was just author-fixed
    rather than player-chosen, so the real gap was narrower than it first looked: made
    `classId` `.optional()` on the `"class"` variant, and `FeatPickerModal` now inserts a
    class-select step before handing off to `WizardSpellbookPicker` when it's unset, reusing
    the same multi-step `Resolving` state machine that already chains multiple `spellChoices`
    rows. Infernal Legacy's level-gated spells: `grantedSpellSchema` gained `minLevel` (character
    level required before the grant applies) and `castAtLevel` (fixed slot-level override, fed
    straight into the granted sheet-spell's `level` field -- `effectiveCastLevel` already just
    reads that, so no new casting-level machinery was needed). Race-trait spells were previously
    seeded once at creation only (`raceGrants()`); `levelUp()` now re-scans race traits on every
    level gain and grants anything newly unlocked, using the same
    `race-trait-spell-${trait.id}-${i}` id convention at both seed and re-check time so a spell
    already granted is never duplicated.

**Verified (#168, done):** JSON-imported "Test Tiefling" with an Infernal Legacy trait granting
Thaumaturgy (at will, no gate), Hellish Rebuke (`minLevel: 3`, `castAtLevel: 2`), and Darkness
(`minLevel: 5`); drove the actual character-creation wizard to create a level-1 character with
that race and confirmed only Thaumaturgy was granted. Leveled up live via the sheet's "Level Up"
button: at level 3 the reminder read "Newly unlocked: Hellish Rebuke" and the API confirmed it
was stored with `level: 2` (from `castAtLevel`); at level 5 "Newly unlocked: Darkness" appeared
and it was added. Separately imported "Test Magic Initiate" (a `spellChoices` row of kind
`"class"` with no `classId`), picked it through the Feat Picker on the same character, and
confirmed a "choose a class" dialog appeared before the spell picker; picking Wizard filtered
the cantrip list to the Wizard spell list (Fire Bolt, Prestidigitation, etc.), and confirming
granted exactly those two spells tagged to the feat. Both `npm test -w shared` (22/22) and
`npm test -w backend` (21/21) still pass. Test character, custom content, dice-roll rows, and
throwaway user deleted after verification.

This closes out the full WP1-WP7 plan from the July 2026 custom-content bug report.

## Theme: DM content parity, quick-toggle conditions, any-attack buffs

169. ✅ **DM content-management parity.** Admins already had a full "edit/delete any custom
    content" power (`CustomContentManager.tsx`'s "All items" list, backed by
    `requireCustomContentOwnerOrAdmin`) -- extended to the `dm` role too, since DMs are
    already the only non-admin role that can create custom content at all
    (`requireGlobalRole("dm", "admin")` on POST/import). Added `isGlobalDmOrAdmin()`
    (`users.service.ts`); renamed the middleware to `requireCustomContentOwnerOrManager`
    and broadened its check; moved the site-wide summary list from admin-only
    `GET /api/admin/content` to `GET /api/custom-content/all` (gated `requireGlobalRole("dm",
    "admin")`) since it's no longer admin-exclusive. Frontend: `isAdmin` became
    `canManageAllContent` in `CustomContentManager.tsx`. Approval/unapproval (`AdminPanel.tsx`,
    `/:id/approve`, `/:id/unapprove`) stays admin-only -- a deliberate scope boundary, not
    touched.

    **Verified:** as one DM, created an item; as a *different* DM, confirmed it appeared
    under "All items" (both via direct API calls and the live UI, including seeing other
    users' pre-existing pending content), edited its name, and confirmed the edit persisted.
    A `player` account got a 403 on both `GET /api/custom-content/all` and
    `PATCH /api/custom-content/:id` against someone else's item. Test item and users deleted
    after verification.

170. ✅ **Quick-toggle common conditions (Blessed / Bane).** Previously the only way to get
    Bless's buff onto `sheet.activeEffects` was to actually cast it (`SpellCastControl`'s
    `onBuff`), which requires the caster to own and prepare the spell -- no way to just mark
    "I'm currently Blessed" (someone else cast it, or an NPC/monster sheet with no spell
    list). Added `bane: per({ attackDice: "-1d4", saveDice: "-1d4" })` to
    `SRD_SPELL_EFFECTS` (`srd-spell-effects.ts`) and a curated `QUICK_CONDITIONS` list
    (`[{srdId: "bless", name: "Blessed"}, {srdId: "bane", name: "Bane"}]`). The Active
    effects box (`Dnd5eSheet.tsx`) now always renders (previously hidden at zero effects) and
    shows a checkbox per quick condition; toggling checks/adds or removes by matching
    `sourceSpellId`, so casting the real spell and the quick toggle are recognized as the
    same status and can't double-stack. `endsWithConcentration: false` deliberately -- there's
    no way to know from a quick toggle whether *your* future concentration should break
    someone else's Bless on you, so it's "on until manually toggled off," matching how
    toggled item effects already behave. The roll-formula layer needed zero changes: both
    `AttackRollControl.roll()` and `Dnd5eSheet`'s `rollCheck()` already special-case a
    leading `-` on a dice term, and the dice library already computes subtracted-dice
    formulas correctly. Added `formatDiceTerm()` (`dnd5e.ts`) and fixed a latent sign-display
    bug in both the sheet's Active-effects summary and `SpellCastControl`'s cast-preview text
    (raw `` `+${dice}` `` string-building, which would have shown Bane's `-1d4` as `+-1d4`);
    also added the `saveDice` line to both displays, missing since #166 even for Bless.

    **Verified:** toggled Blessed on a live character with no Bless prepared -- Active
    effects showed "Blessed: +1d4 to hit, +1d4 to saves"; toggled Bane too -- showed "Bane:
    -1d4 to hit, -1d4 to saves" (correct sign, not "+-1d4"). Rolled an attack with both
    active: `1d20+1d4-1d4+5`, individual rolls 9/1/4/+5 = 11 (9+1-4+5), confirming the
    formula mathematically subtracts, not just displays a sign. Toggled both off and
    confirmed the entries were removed.

171. ✅ **Effects that apply to any attack, not just weapon attacks.** Found while
    implementing #170: `activeEffectAttackDice`/`activeEffectDamageDice` (Bless's roll die,
    a Hex/Hunter's-Mark-style bonus-damage buff) were wired into `AttackRollControl` only
    (the sheet's weapon "Attacks" list) -- neither `SpellCastControl` nor
    `EldritchBlastControl` read them, so Bless never helped a spell attack roll and a
    Hex-style damage buff could never apply to one, even though Bless's own text ("any
    attack roll") and Hex's ("whenever you hit it with an attack") both RAW-apply to spell
    attacks too -- unlike Hunter's Mark/Divine Favor/Magic Weapon/Branding Smite, which are
    explicitly weapon-scoped. Added `appliesToSpellAttacks: z.boolean().default(false)` to
    `buffEffectSchema`, defaulting every existing curated/authored buff to weapon-only
    (matching their real text) except Bless and Bane, which get the override (both say "any
    attack roll or saving throw"). Added `activeEffectSpellAttackDice`/
    `activeEffectSpellAttackBonus`/`activeEffectSpellDamageDice` (`dnd5e.ts`) -- filtered
    variants of the existing aggregators, following their own "separate named function per
    call site" convention rather than an optional param; the unfiltered originals keep
    feeding `AttackRollControl` unchanged, since a weapon attack should always get both
    weapon-scoped and any-scoped effects. Folded `activeEffectSpellAttackBonus` into
    `spellAttackBonusForAbility()`. Threaded new `extraAttackDice`/`extraDamage` props into
    `SpellCastControl.tsx` and `EldritchBlastControl.tsx` (same shapes/roll-building pattern
    `AttackRollControl` already uses, including a new `onHit` consumption callback on
    `SpellCastControl`); non-attack-roll spells (Fireball) never get `extraDamage` -- a save
    spell was never "an attack" to trigger an attack-triggered rider. Added the missing
    `saveDice` field (another #166 gap) and a new "Applies to spell attacks too" checkbox to
    both the custom-spell buff editor and the item toggle-effect editor in
    `CustomContentManager.tsx`.

    **Verified:** gave a level-3 Wizard Fire Bolt (a cantrip with an attack roll) and no
    weapon attacks. With no active effects, "Fire Bolt attack roll" was a plain
    `1d20+5`. Toggled Blessed: the roll became `1d20+1d4+5`. Authored a custom "Test Hex
    Alike" spell (`buff: {damageDice: "1d6", damageType: "necrotic", appliesToSpellAttacks:
    true}`), cast it, then cast Fire Bolt again and hit -- got a separate "Fire Bolt bonus
    damage (Test Hex Alike, necrotic)" roll line, absent entirely on a Miss (matching
    "attack-triggered, not automatic"). Set that effect's `appliesToSpellAttacks` to `false`
    directly and recast Fire Bolt: the bonus-damage line disappeared from the spell roll, but
    rolling a separately-added weapon attack (`Test Shortsword`) still produced both "Test
    Shortsword bonus damage (Test Hex Alike, necrotic)" *and* the Blessed `+1d4` on its
    attack roll -- confirming the weapon path stays unfiltered regardless of the flag. Also
    confirmed `EldritchBlastControl`'s "Beam 1 attack" picked up Blessed's `+1d4` the same
    way. `npx tsc --noEmit -p shared` / `npx tsc -b` clean throughout; both test suites still
    pass (shared 22/22, backend 21/21). Test character, custom spell, and throwaway users
    deleted after verification.
