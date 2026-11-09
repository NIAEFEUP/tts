# TTS — Time Table Selector

A platform where students can experiment with all the possible combinations of class schedules
they can pick at the start of the semester.

Made with ❤️ by [NIAEFEUP](https://ni.fe.up.pt). Production: <https://tts.niaefeup.pt>.

This repository is a **Bun workspace monorepo** with two apps and a shared package:

| Path               | Stack                                           | Dev URL               |
| ------------------ | ----------------------------------------------- | --------------------- |
| `apps/backend`     | Bun + Elysia + Prisma 8                         | http://localhost:3000 |
| `apps/frontend`    | React + Vite + Tailwind                         | http://localhost:3100 |
| `packages/sigarra` | TypeScript SDK for SIGARRA, generated with Fern | —                     |

> New here? Follow **[Quick start](#quick-start-fresh-clone)** top to bottom. For team workflow
> (branching, commits, PRs) read [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md).

## Table of contents

- [Requirements](#requirements)
- [Quick start (fresh clone)](#quick-start-fresh-clone)
- [Run the app](#run-the-app)
- [Environment variables](#environment-variables)
- [Authentication](#authentication)
- [Database](#database)
- [Docker](#docker)
- [SIGARRA SDK](#sigarra-sdk)
- [Quality checks & CI](#quality-checks--ci)
- [Useful commands](#useful-commands)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Further documentation](#further-documentation)

## Requirements

- **[Bun](https://bun.sh) >= 1.4** — the runtime and package manager for the whole monorepo.
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **[Docker](https://www.docker.com/) + Docker Compose** — runs the local PostgreSQL database
  (and the optional containerized apps).
- _(Optional)_ **[devenv](https://devenv.sh) / Nix** — the repo ships a `devenv.nix` + `.envrc`
  that provide Node 22, Bun and corepack. If you use `direnv`, run `direnv allow` once.

## Quick start (fresh clone)

Every command below is meant to be copy-pasted from the repository root unless a `cd` is shown.

```bash
# 0. Clone
git clone https://github.com/NIAEFEUP/tts-fe.git   # or the SSH URL if you prefer
cd tts-fe

# 1. Install all workspace dependencies (installs both apps and the SIGARRA SDK)
bun install

# 2. Start PostgreSQL (127.0.0.1:5434, user/password/db = tts/tts/tts)
#    `--wait` blocks until the database is actually accepting connections.
docker compose up -d --wait

# 3. Create the app env files (both are git-ignored; the committed .env.schema holds
#    working defaults). The frontend copy is optional for local dev.
cp apps/backend/.env.schema  apps/backend/.env
cp apps/frontend/.env.schema apps/frontend/.env

# 4. Edit apps/backend/.env and set at least your own NMEC ("up" number) and role.
#    See the Environment variables section below.

# 5. Generate the Prisma contract, create the tables, and seed the demo data.
cd apps/backend
bun run contract:emit     # generate contract.json + contract.d.ts (git-ignored)
bun run db:init           # create all tables (empty DB only)
bun run db:seed:demo      # catalog + demo data; makes ADMIN_UP an admin
cd ../..
```

`db:seed:demo` is the last step on purpose: `db:seed` and `db:seed:demo` are mutually exclusive and
both truncate every table first, so if you run `db:seed` afterwards you lose the demo exchange data.

## Run the app

Start the two servers in two terminals (both hot-reload on save):

```bash
# terminal 1 — backend  →  http://localhost:3000
cd apps/backend && bun run dev

# terminal 2 — frontend →  http://localhost:3100
cd apps/frontend && bun run dev
```

Open <http://localhost:3100>.

**Daily loop:** `docker compose up -d` (if the database is stopped) plus the two `bun run dev`.

## Environment variables

Both apps declare their environment in a **committed `.env.schema`** and validate it at startup
with [varlock](https://varlock.dev). The schema is the source of truth; local overrides go in a
git-ignored `.env` (or `.env.local`) sitting next to it. Validate at any time with:

```bash
bunx varlock load          # run from inside apps/backend or apps/frontend
```

### Backend — `apps/backend/.env`

| Variable                                | Default                               | Notes                                                                       |
| --------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`                          | `postgresql://tts:tts@localhost:5434` | Matches the Docker Compose database.                                        |
| `ADMIN_UP`                              | `up2026xxxxx`                         | **Set to your own NMEC.** Seeded as the demo admin by `db:seed:demo`.       |
| `ADMIN_ROLE`                            | `ADMIN`                               | `USER` \| `ADMIN` \| `SUPERUSER`.                                           |
| `PORT`                                  | `3000`                                | Backend port.                                                               |
| `FRONTEND_URL` / `ALLOWED_ORIGINS`      | `http://localhost:3100`               | Post-login target and credentialed-CORS allowlist.                          |
| `DEV_LOGIN_ENABLED`                     | `true`                                | Enables username/password dev login; forced off when `NODE_ENV=production`. |
| `SIGARRA_USERNAME` / `SIGARRA_PASSWORD` | empty                                 | Sigarra account the dev login authenticates as (only read in dev).          |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | empty                                 | Needed only for real Sigarra OIDC login.                                    |

`ADMIN_UP` is stored as bare digits internally, so `up202207150` and `202207150` are the same
account. See [`apps/backend/.env.schema`](./apps/backend/.env.schema) for the full, commented list
(session TTL, cookie flags, OIDC endpoints/scopes, …).

### Frontend — `apps/frontend/.env`

Optional for local dev (the schema defaults are enough). Useful overrides:

| Variable                  | Default                 | Notes                                                            |
| ------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `PORT`                    | `3100`                  | Vite dev-server port.                                            |
| `VITE_APP_BACKEND_URL`    | `http://localhost:3000` | Backend the SPA talks to.                                        |
| `VITE_APP_FEDERATED_AUTH` | `false`                 | `true` shows the Sigarra OIDC login button instead of dev login. |

Only `VITE_`-prefixed variables reach the browser; everything else is treated as sensitive. In
code, read them through varlock's typed `ENV` object (`import { ENV } from 'varlock/env'`) — not
`import.meta.env` (always a string, so `"false"` is truthy). See
[`apps/frontend/.env.schema`](./apps/frontend/.env.schema) for the full list.

## Authentication

Two flows, selected by environment:

- **Local dev — username/password.** `POST /v1/auth/dev-login` validates `SIGARRA_USERNAME` /
  `SIGARRA_PASSWORD` against Sigarra and issues a cookie session. Enabled by `DEV_LOGIN_ENABLED`
  (on by default, forced off when `NODE_ENV=production`). The frontend shows this button when
  `VITE_APP_FEDERATED_AUTH=false` (the default).
- **Production — Sigarra OIDC.** `GET /v1/auth/login` redirects to Sigarra; the callback
  exchanges the code, upserts the user and sets the same httpOnly `session` cookie. Set
  `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_REDIRECT_URI` / `FRONTEND_URL` / `ALLOWED_ORIGINS`
  on the backend and `VITE_APP_FEDERATED_AUTH=true` on the frontend.

Routes are served under `/v1`; the public URL also carries an `/api` prefix added by the
deployment (Niployments), so the frontend's `VITE_APP_BACKEND_URL` must include it (e.g.
`https://tts.niaefeup.pt/api`) in staging and production.

Roles are assigned by **seeding**, never by logging in: `db:seed:demo` creates the `ADMIN_UP`
account with `ADMIN_ROLE` and full admin scope.

## Database

The schema and runtime client live in [`apps/backend/src/infrastructure/database/`](./apps/backend/src/infrastructure/database/):

| File              | Purpose                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `contract.prisma` | The schema — the source of truth. Edit this.                             |
| `contract.json`   | Generated by `contract:emit`. Do not edit. **Git-ignored.**              |
| `contract.d.ts`   | Generated by `contract:emit`. Do not edit. **Git-ignored.**              |
| `prisma.ts`       | Runtime client. `import { db } from '@/infrastructure/database/prisma'`. |

The project uses **Prisma 8** (contract-first, `@prisma/orm-postgres`) — do **not** follow Prisma
6/7 guides. See [`apps/backend/docs/tech-stack.md`](./apps/backend/docs/tech-stack.md) for the full
rationale and client usage, and [`apps/backend/docs/database.md`](./apps/backend/docs/database.md)
for the migration model, data transforms and recovery paths.

### Seeding

Both seed scripts **truncate every table first** and produce deterministic ids, so they are safe to
re-run.

| Command                | Populates                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `bun run db:seed`      | **Catalog only** — faculties, courses, course units and occurrences, from the committed fixture.                                    |
| `bun run db:seed:demo` | **Catalog plus the mock exchange layer** — users, classes, enrollments, exchange windows, sample exchanges and enrollment requests. |

> ⚠️ **The two are mutually exclusive.** `db:seed` wipes the demo data and `db:seed:demo` re-creates
> it. Always finish with `db:seed:demo` if you want exchanges.

The demo admin is **you**: set `ADMIN_UP` to your NMEC in `apps/backend/.env`. `db:seed:demo`
creates that account with role `ADMIN_ROLE`. Both seeds refuse to run unless `DATABASE_URL` points
at a loopback host.

The catalog is real scraper data in
[`src/scripts/fixtures/feup-leic-meic-mesw.json`](./apps/backend/src/scripts/fixtures/feup-leic-meic-mesw.json);
regenerate it from the repo-root `database.db` with `bun run catalog:extract`. The mock layer covers
L.EIC and M.EIC only.

### Changing the schema

```
edit contract.prisma → contract:emit → (dev: db:update)  or  (shared/prod: migration:plan → migrate)
```

**Quick path (local dev only):** applies the diff directly, no migration history — never use against
a shared database.

```bash
cd apps/backend
# 1. edit src/infrastructure/database/contract.prisma
bun run contract:emit
bun run db:update
```

**Formal path (reviewed, version-controlled, replayable):**

```bash
cd apps/backend
# 1. edit src/infrastructure/database/contract.prisma
bun run contract:emit
# 2. plan a migration (writes migrations/app/<timestamp>_<slug>/)
bun run migration:plan -- --name <slug>
# 3. review the generated files
bun run migration:show -- <dir-name-or-hash-prefix>
# 4. preview, then apply
bun run migrate:show
bun run migrate
# 5. refresh the local `db` ref (it lags after a plain migrate)
bun run db:update
```

Adding a `NOT NULL` column with no default leaves a `placeholder(...)` in the generated
`migration.ts`; fill in the data transform, self-emit with `node migrations/app/<dir>/migration.ts`,
then `bun run migrate`.

### Database debugging

```bash
cd apps/backend
bun run db:verify           # verify the live DB matches the contract (0 = clean, 4 = drift)
bun run db:schema           # print the live DB schema as a tree
bun run migration:status    # pending / applied migration state
bun run migration:list      # all on-disk migrations as a graph
bun run db:sign             # re-sign the marker after a manual DB fix
bun run db:studio           # open Prisma Studio (visual DB inspector)
```

### Recovering from common errors

| Error                            | Cause                                       | Fix                                                              |
| -------------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| `MIGRATION.HASH_MISMATCH`        | `migration.ts` edited without self-emitting | `node migrations/app/<dir>/migration.ts`, then `bun run migrate` |
| `MIGRATION.UNFILLED_PLACEHOLDER` | Placeholder not filled in `migration.ts`    | Fill the transform, self-emit, then `bun run migrate`            |
| `MIGRATION.PLAN_ORIGIN_UNKNOWN`  | No `db` ref and migrations already exist    | Run `bun run db:update`, or pass `--from <hash>`                 |
| `MIGRATION.HASH_NOT_IN_GRAPH`    | `db` ref points past the graph              | `bun run migration:ref:set -- db <hash>`, then re-plan           |
| `CONTRACT.MARKER_MISSING`        | DB has no marker (fresh DB or wipe)         | `bun run db:init`                                                |
| `CONTRACT.MARKER_MISMATCH`       | DB is at a different contract version       | Migrate forward, or `bun run db:sign` if the DB is correct       |

## Docker

### Database (always needed)

Run from the repository root:

```bash
docker compose up -d --wait    # start PostgreSQL and wait until healthy
docker compose down            # stop (keeps the data volume)
docker compose down -v         # stop and wipe the database volume
docker compose logs -f postgres
```

### Frontend in Docker (optional)

From `apps/frontend`:

```bash
# Development container (hot reload, port 3100)
chmod +x build.sh dev.sh prod.sh   # once, if scripts aren't executable
./build.sh dev                    # docker compose build tts-frontend
./dev.sh                          # docker compose up tts-frontend
docker compose down               # stop

# Production container (static build served by nginx)
touch .env                        # production build copies .env into the image
./build.sh prod                   # docker compose build tts-frontend-prod
./prod.sh                         # docker compose up tts-frontend-prod
```

### Building app images (from the repository root)

The root `Dockerfile` is multi-stage with targets `backend-dev`, `backend-prod`, `frontend-dev`,
`frontend-prod`:

```bash
docker build --target backend-prod  -t tts-be .
docker build --target frontend-prod -t tts-fe .
```

## SIGARRA SDK

`packages/sigarra` (`@tts/sigarra`, private) is a TypeScript SDK for [SIGARRA](https://sigarra.up.pt), generated by [Fern](https://buildwithfern.com) from the hand-written OpenAPI spec [`packages/sigarra/openapi.json`](./packages/sigarra/openapi.json). The generated code is committed under `packages/sigarra/src/generated`: never edit it by hand. After changing the spec, regenerate it from `packages/sigarra` with `bun run generate` (needs Docker and `node`). Retries are opt-in (default `0`). See [`packages/sigarra/README.md`](./packages/sigarra/README.md) for details.

## Quality checks & CI

The monorepo uses [Oxlint](https://oxc.rs) for linting and [Oxfmt](https://oxc.rs) for formatting.
A Husky pre-commit hook runs `oxfmt --check` and `oxlint` automatically on every commit.

```bash
# from the repository root
bun run lint            # lint the workspace (oxlint)
bun run lint:fix        # lint + auto-fix
bun run format          # format the workspace (apps + SIGARRA package)
bun run format:check    # check formatting without writing

# per app
cd apps/backend  && bun run test && bun run typecheck   # bun test; emits contract then tsc
cd apps/frontend && bun run typecheck && bun run build  # tsc; needs the emitted contract
cd packages/sigarra && bun run typecheck                # tsc --noEmit
```

Before pushing, run the same checks CI runs: `bun run contract:emit` in `apps/backend`,
`bun run typecheck` and `bun run test` there, `bun run typecheck` in `apps/frontend` and
`packages/sigarra`, and `bun run lint` from the root. See [`.github/workflows/codeanalysis.yaml`](./.github/workflows/codeanalysis.yaml).

## Useful commands

```bash
# ── repo root ───────────────────────────────────────────────────────────────
bun install                 # install all workspace dependencies
bun run lint                # lint both apps (oxlint)
bun run lint:fix            # lint + auto-fix
bun run format              # format both apps (oxfmt)
bun run format:check        # check formatting

# ── backend (apps/backend) ──────────────────────────────────────────────────
bun run dev                 # dev server + hot reload (http://localhost:3000)
bun run start               # production server
bun run test                # run tests (bun test)
bun run test:watch          # tests in watch mode
bun run test:coverage       # tests with coverage
bun run typecheck           # contract:emit + tsc
bun run lint                # oxlint
bun run contract:emit       # regenerate contract.json + contract.d.ts
bun run catalog:extract     # regenerate the scraper fixture from database.db
bun run db:init             # create tables on an empty DB + write the marker
bun run db:update           # quick dev-only schema sync (no migration history)
bun run db:seed             # seed catalog only (truncates)
bun run db:seed:demo        # seed catalog + demo data (truncates; makes ADMIN_UP admin)
bun run db:verify           # verify live DB matches the contract
bun run db:schema           # print live DB schema as a tree
bun run db:sign             # re-sign the marker after a manual DB fix
bun run db:studio           # open Prisma Studio
bun run migrate             # apply all pending migrations
bun run migrate:show        # preview what would run (no writes)
bun run migration:plan -- --name <slug>   # plan a migration
bun run migration:show -- <dir>           # inspect one migration package
bun run migration:status    # pending / applied state
bun run migration:list      # list on-disk migrations as a graph
bun run migration:ref:set -- <name> <hash> # set a migration ref pointer

# ── frontend (apps/frontend) ────────────────────────────────────────────────
bun run dev                 # Vite dev server (http://localhost:3100)
bun run build               # typecheck + production build
bun run typecheck           # typecheck only
bun run preview             # preview the production build locally
bun run lint                # oxlint

# ── SIGARRA SDK (packages/sigarra) ──────────────────────────────────────────
bun run generate            # regenerate src/generated from openapi.json (needs Docker)
bun run typecheck           # tsc --noEmit

# ── docker ──────────────────────────────────────────────────────────────────
docker compose up -d --wait # start PostgreSQL
docker compose down         # stop (keeps data)
docker compose down -v      # stop and wipe data
docker build --target backend-prod  -t tts-be .
docker build --target frontend-prod -t tts-fe .
```

## Project structure

```
.
├── apps/
│   ├── backend/                 # Bun + Elysia + Prisma 8 API
│   │   ├── src/
│   │   │   ├── application/     # Use-cases (business logic)
│   │   │   ├── core/            # Auth, config, utils
│   │   │   ├── domain/          # Entities, ports, value objects
│   │   │   ├── infrastructure/  # Database (Prisma), external adapters
│   │   │   └── interface/       # Routes, middleware, validators
│   │   ├── docs/                # endpoints.md, tech-stack.md, database.md, schema-migration.md
│   │   ├── legacy/              # Old Django backend (deprecated)
│   │   └── .env.schema          # Backend env vars + defaults (varlock)
│   └── frontend/                # React + Vite SPA
│       ├── src/
│       └── .env.schema          # Frontend env vars + defaults (varlock)
├── packages/
│   └── sigarra/                 # @tts/sigarra — Fern-generated TypeScript SDK
│       ├── openapi.json         # Hand-written OpenAPI spec (source of truth)
│       ├── src/generated/       # Generated code — never edit by hand
│       └── scripts/             # Post-generation patches (Headers, retries)
├── docs/                        # Cross-cutting docs
├── .github/                     # CI workflows, issue/PR templates, CONTRIBUTING
├── docker-compose.yaml          # PostgreSQL for local dev
├── Dockerfile                   # Multi-stage images for both apps
└── package.json                 # Workspace root (lint, format, scripts)
```

The backend follows a layered, domain-driven pattern: `interface` (thin routes) → `application`
(use-cases) → `domain` (entities/ports, framework-free) → `infrastructure` (Prisma, adapters).

## Troubleshooting

### `bun run db:init` fails with `MIGRATION.PLANNING_FAILED`

`db:init` only works on an **empty** database. If the DB already has tables, either it is already
current (`bun run db:sign`) or you need to wipe and recreate it:

```bash
# from the repository root
docker compose down -v      # stop and wipe the database volume
docker compose up -d --wait # start fresh

cd apps/backend
bun run contract:emit
bun run db:init
bun run db:seed:demo
```

### `bun run typecheck` complains about missing models or unknown fields

`contract.json` and `contract.d.ts` are git-ignored, so a fresh clone — or a pull that changed
`contract.prisma` — leaves the generated Prisma client missing or stale (errors like
`Cannot find module './contract.d.ts'` or `Property 'Occurrence' does not exist`). This is **not** a
code bug — regenerate the client:

```bash
cd apps/backend
bun run contract:emit
```

`bun run typecheck` runs `contract:emit` first, so unless you invoked `tsc` directly the client
cannot be stale.

### Frontend can't reach the backend / CORS errors

Make sure the backend is running on `:3000`, `VITE_APP_BACKEND_URL` points at it, and the backend's
`ALLOWED_ORIGINS` includes the frontend origin (`http://localhost:3100` by default).

### A fresh `bun run build` in the frontend fails to resolve the backend types

The frontend type-checks against the backend's emitted declarations, so emit the contract first
(`cd apps/backend && bun run contract:emit`).

## Further documentation

- [`.github/CONTRIBUTING.md`](./.github/CONTRIBUTING.md) — branching, commits, PRs, code standards.
- [`apps/backend/docs/endpoints.md`](./apps/backend/docs/endpoints.md) — **the** API source of truth.
- [`apps/backend/docs/tech-stack.md`](./apps/backend/docs/tech-stack.md) — stack decisions and Prisma 8 usage.
- [`apps/backend/docs/schema-migration.md`](./apps/backend/docs/schema-migration.md) — legacy Django → Prisma 8 mapping.
- [`packages/sigarra/README.md`](./packages/sigarra/README.md) — SIGARRA SDK generation and retry policy.
- [`docs/all-issues-guide.md`](./docs/all-issues-guide.md) — the cutover issue breakdown.
