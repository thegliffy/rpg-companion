# RPG Companion

A self-hosted tabletop RPG companion web app. Fully useful to a single solo player with no
group at all — campaigns are an optional social layer on top of personal tools.

Live instance: https://ttrpg.gliffy.tv

## Features

- **Character sheets** for D&D 5e (deep, auto-calculating), Pathfinder 2e, and a generic
  custom-field system. Full-screen sheets with a guided multi-step creation wizard (four stat
  methods: 4d6-drop-lowest, standard array, point buy, manual).
- **D&D 5e depth**: SRD spells/casting with a class-restricted picker and cast/attack/damage
  rolls, per-class spellcasting + martial progression, level-up flow with ASI/feats, inventory
  with weight/currency and equip effects, conditions, death saves, Wild Shape (Druid), Warlock
  pact features, and more.
- **Custom content**, system-scoped and admin-approved: homebrew races, subraces, classes,
  subclasses, backgrounds, feats, spells, items, and monsters — with the same mechanical depth
  as the built-in SRD content.
- **Bestiary** (full SRD monster set) and an **Arena** to simulate turn-by-turn 1v1 fights.
- **Campaigns** (optional): membership + roles, shared notes, a real-time initiative tracker,
  a live dice-roll feed, and a DM-run shop.
- Personal dice roller and notes usable with no campaign at all.

## Tech stack

- **Monorepo** via npm workspaces: `backend/`, `frontend/`, `shared/`.
- **Backend**: Express 5, Socket.IO, Drizzle ORM + better-sqlite3 (SQLite), express-session,
  bcrypt.
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

## Production / deployment

Every push to `main` triggers a GitHub Action
([`.github/workflows/docker-image.yml`](.github/workflows/docker-image.yml)) that builds the
Docker image and publishes it to the GitHub Container Registry as
`ghcr.io/thegliffy/rpg-companion:latest`. To deploy on the server:

```bash
# one-time, if the GHCR package is private:
#   docker login ghcr.io -u <github-username>   (paste a PAT with read:packages)

docker compose pull        # fetch the freshly built image
docker compose up -d       # recreate the container
```

Migrations run automatically on container start. Persistent data (SQLite DB, uploaded
portraits) lives in the `data/` volume and is **not** checked into version control. A
`.env` file next to `docker-compose.yml` must define `SESSION_SECRET`.

## Licensing & attribution

- Application code is released under the [MIT License](./LICENSE).
- Game rules content is from the **System Reference Document 5.1 ("SRD 5.1")** by Wizards of
  the Coast LLC, licensed under [Creative Commons Attribution 4.0 International
  (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/legalcode). The structured SRD
  datasets were sourced from the open [5e-bits/5e-database](https://github.com/5e-bits/5e-database)
  project (also CC-BY-4.0). Pathfinder 2e structure follows the ORC-licensed rules.
