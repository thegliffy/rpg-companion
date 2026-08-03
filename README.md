# RPG Companion

A self-hosted tabletop RPG companion web app. Fully useful to a single solo player with no
group at all — campaigns are an optional social layer on top of personal tools.

## Features

- **Character sheets** for D&D 5e (deep, auto-calculating), Pathfinder 2e, and a generic
  custom-field system. Full-screen sheets with a guided multi-step creation wizard (four stat
  methods: 4d6-drop-lowest, standard array, point buy, manual; class/race/background choices;
  starting-equipment picks that auto-equip armor and auto-generate attack rows). The 5e sheet
  also has a toggleable printable/traditional layout alongside the structured editing view.
- **D&D 5e depth**: SRD spells/casting with a class-restricted picker and cast/attack/damage
  rolls, per-class spellcasting + martial progression, level-up flow with ASI/feats, inventory
  with weight/currency and equip effects (SRD and custom items — including equipment packs —
  resolve to real weight/AC/damage, not just names), conditions, death saves, Wild Shape (Druid),
  Warlock pact features, and more.
- **Visual dice rolling** app-wide: animated die-face rolls for every d20/damage formula, with
  automatic critical-hit/miss detection and crit damage doubling.
- **Six selectable themes**, including a high-contrast mode — always renders paper-white on
  print regardless of which theme is active on screen.
- **Custom content**, system-scoped and admin-approved: homebrew races, subraces, classes,
  subclasses, backgrounds, feats, spells, items, and monsters — with the same mechanical depth
  as the built-in SRD content, plus a JSON pack importer for bulk authoring.
- **Bestiary** (full SRD monster set) and an **Arena** to simulate turn-by-turn 1v1 fights.
- **Campaigns** (optional): membership + roles, shared notes, a real-time initiative tracker,
  a live dice-roll feed, and a DM-run shop.
- Read-only public share links and portrait uploads for any character; a Hall of Heroes for
  characters marked dead or retired.
- Personal dice roller and notes usable with no campaign at all.
- Scriptable via [API tokens](#api) for automation outside the browser.

## Tech stack

- **Monorepo** via npm workspaces: `backend/`, `frontend/`, `shared/`.
- **Backend**: Express 5, Socket.IO, Drizzle ORM + better-sqlite3 (SQLite), express-session,
  bcrypt, multer (uploads), `@dice-roller/rpg-dice-roller` (server-authoritative dice).
- **Frontend**: React 19 + TypeScript + Vite (SPA).
- **Shared**: Zod schemas + a system-plugin architecture shared by both ends.
- **Packaging**: Docker / docker-compose.

## Development

```bash
# 1. Install dependencies (root installs all workspaces)
npm install

# 2. Create your environment file from the template
cp .env.example .env
# then edit .env and set SESSION_SECRET to a long random string

# 3. Apply database migrations
npm run db:migrate -w backend

# 4. Run everything (shared tsc watch + backend on :3001 + frontend on :5173)
npm run dev
```

The frontend dev server proxies API/socket calls to the backend.

Tests (`backend/` and `shared/`, Node's built-in test runner) and lint (`frontend/`, oxlint):

```bash
npm test -w backend
npm test -w shared
npm run lint -w frontend
```

## API

Everything under `/api/*` speaks JSON. Two ways to authenticate:

- **Browser session** — the normal cookie-based login the frontend itself uses.
- **API token** — an `Authorization: Bearer rpgc_...` header, for scripts and automation. Create
  one from the home page (DM/admin accounts see an **API tokens** panel there): name it, optionally
  set an expiry, then **Create token**. The plaintext value is shown exactly once — copy it
  immediately, it can't be retrieved again. A token authenticates as its owner with their normal
  permissions and can be revoked independently of changing your password; token requests never
  touch the session store, so scripted calls don't leave rows behind. The token-creation UI also
  hands you a ready-to-run `curl` example against `/api/custom-content/import`, the main scripted
  use case (bulk-importing homebrew content as a JSON pack).

| Base path | Covers |
|---|---|
| `/api/auth` | Register, login/logout, current session, account preferences (e.g. theme) |
| `/api/characters` | CRUD, campaign attach/detach, read-only share links, portrait upload |
| `/api/campaigns` | CRUD, membership/invite codes, and nested: notes, initiative tracker, dice-roll feed, DM shop |
| `/api/notes` | Personal notes (no campaign required) |
| `/api/encounters` | Personal (non-campaign) initiative tracker |
| `/api/rolls` | Personal dice-roll history |
| `/api/custom-content` | Homebrew races/subraces/classes/subclasses/backgrounds/feats/spells/items/monsters — CRUD, JSON pack import, admin approval |
| `/api/tokens` | Manage your own API tokens (session auth only — a token can't mint or list its own successors) |
| `/api/admin` | User/content/character management (admin role only) |
| `/api/shared/characters/:token` | Public, unauthenticated read-only character view behind a share link |
| `/api/health` | Liveness + DB check |

There's no separate API reference document — request/response shapes live in the route handlers
(`backend/src/routes/`) and the Zod schemas in `shared/src/`, which both the frontend and backend
validate every request/response against, so the schemas are the source of truth for exact payloads.

## Production / deployment

Every push to `main` triggers a GitHub Action
([`.github/workflows/docker-image.yml`](.github/workflows/docker-image.yml)) that builds the
Docker image and publishes it to the GitHub Container Registry as
`ghcr.io/thegliffy/rpg-companion:latest`.

The repo's [`docker-compose.yml`](./docker-compose.yml) is a ready-to-use example — pulls the
published image (falling back to a local `docker compose build` via `build: .` if you'd rather
build it yourself), persists the SQLite database and uploaded portraits in a bind-mounted
`data/` volume, and binds to `127.0.0.1` only so it's meant to sit behind a reverse proxy
(Caddy, nginx, etc.) rather than being exposed directly:

```yaml
services:
  app:
    image: ghcr.io/thegliffy/rpg-companion:latest
    build: .
    ports:
      - "127.0.0.1:8090:3000"   # adjust the host port/binding to taste
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_PATH: /app/data/app.db
      SESSION_SECRET: ${SESSION_SECRET}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Copy [`.env.example`](./.env.example) to `.env` next to `docker-compose.yml` and set
`SESSION_SECRET` to a long random string, then deploy:

```bash
# one-time, if the GHCR package is private:
#   docker login ghcr.io -u <github-username>   (paste a PAT with read:packages)

docker compose pull        # fetch the freshly built image
docker compose up -d       # recreate the container
```

Migrations run automatically on container start. Persistent data (SQLite DB, uploaded
portraits) lives in the `data/` volume and is **not** checked into version control.

## Licensing & attribution

- Application code is released under the [MIT License](./LICENSE).
- Game rules content is from the **System Reference Document 5.1 ("SRD 5.1")** by Wizards of
  the Coast LLC, licensed under [Creative Commons Attribution 4.0 International
  (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/legalcode). The structured SRD
  datasets were sourced from the open [5e-bits/5e-database](https://github.com/5e-bits/5e-database)
  project (also CC-BY-4.0). Pathfinder 2e structure follows the ORC-licensed rules.
