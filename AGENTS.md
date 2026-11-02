# AGENTS.md

This file provides guidance to AI coding assistants working on this project.

## Project Overview

**TTS (Time Table Selector)** — a platform where students experiment with class schedule combinations. Developed by [NIAEFEUP](https://ni.fe.up.pt) (FEUP student organization).

- **Production**: https://tts.niaefeup.pt
- **Monorepo**: Bun workspace with `apps/backend`, `apps/frontend` and `packages/sigarra`

## Tech Stack

| Layer | Stack |
|-------|-------|
| Runtime | Bun >= 1.4 |
| Backend | Bun + Elysia + Prisma 8 (contract-first) + PostgreSQL 16 |
| Frontend | React 19 + Vite 5 + Tailwind CSS v4 + React Router v6 |
| Data fetching | SWR + Eden Treaty (type-safe API client) |
| Real-time | Socket.IO |
| UI primitives | Radix UI, Headless UI |
| Validation | Zod + varlock (env vars) |
| Formatting/Linting | Oxfmt + Oxlint (NOT Prettier/ESLint) |
| SIGARRA SDK | OpenAPI 3.1 spec + Fern-generated TypeScript client |

## Commands

### Root
```bash
bun install              # Install all workspace dependencies
bun run lint             # Lint both apps
bun run lint:fix         # Lint + auto-fix
bun run format           # Format both apps
bun run format:check     # Check formatting only
```

### Backend (`apps/backend`)
```bash
bun run dev              # Dev server (http://localhost:3000)
bun run test             # Run tests
bun run typecheck        # contract:emit + tsc
bun run contract:emit    # Regenerate contract.json + contract.d.ts
bun run db:init          # Create tables on empty DB
bun run db:seed          # Seed catalog only (truncates all tables)
bun run db:seed:demo     # Seed catalog + demo data (truncates all tables)
bun run db:verify        # Verify live DB matches contract
bun run db:studio        # Open Prisma Studio
bun run migrate          # Apply pending migrations
```

### Frontend (`apps/frontend`)
```bash
bun run dev              # Dev server (http://localhost:3100)
bun run build            # typecheck + production build
bun run typecheck        # Typecheck only
bun run preview          # Preview production build
```

### SIGARRA SDK (`packages/sigarra`)
```bash
bun run typecheck        # Typecheck only
bun run generate         # Regenerate src/generated from openapi.json (needs Docker)
```

### Docker
```bash
docker compose up -d --wait   # Start PostgreSQL
docker compose down           # Stop (keeps data)
docker compose down -v        # Stop and wipe data
```

## Project Structure

```
apps/
├── backend/
│   ├── src/
│   │   ├── application/     # Use-cases (business logic)
│   │   ├── core/            # Auth, config, utils
│   │   ├── domain/          # Entities, ports, value objects (framework-free)
│   │   ├── infrastructure/  # Prisma, external adapters
│   │   └── interface/       # Routes, middleware, validators
│   ├── docs/                # endpoints.md, tech-stack.md, database.md
│   ├── contract.prisma      # Prisma 8 contract (single source of truth)
│   ├── tests/               # Bun test files
│   └── legacy/              # Old Django backend (DEPRECATED, do not modify)
└── frontend/
    └── src/
        ├── @types/          # TypeScript type definitions
        ├── api/             # API client, services, storage
        ├── components/      # React components (ui/, admin/, exchange/, planner/)
        ├── contexts/        # React Context providers
        ├── hooks/           # Custom React hooks
        ├── pages/           # Page components
        ├── styles/          # CSS (Tailwind + custom)
        ├── utils/           # Utility functions
        └── config/          # App config (local.json, prod.json)
packages/
└── sigarra/
    ├── openapi.json         # Hand-written OpenAPI spec of SIGARRA (single source of truth)
    ├── fern/                # Fern config and SDK-only spec overrides
    ├── scripts/             # Patches applied to the generated SDK
    └── src/generated/       # Fern-generated TypeScript SDK (committed, do not edit)
```

### Backend Architecture (Clean Architecture)

Layered, domain-driven pattern — **respect the layer boundaries**:

- **Interface layer**: Thin routes, middleware, validators — no business logic here
- **Application layer**: Use-cases — orchestrates domain objects
- **Domain layer**: Entities, ports, value objects — must stay framework-free
- **Infrastructure layer**: Prisma, external adapters — only layer that talks to DB/external services

Dependencies point inward. Domain must never import from Application, Interface, or Infrastructure.

## Code Conventions

### Linting & Formatting
- **Linter**: Oxlint (not ESLint)
- **Formatter**: Oxfmt (not Prettier)
- **Pre-commit hook**: Husky runs `oxfmt --check` and `oxlint` automatically

### TypeScript
- **Backend**: Strict mode, target ES2022
- **Frontend**: Strict mode disabled, target ES2015
- **Path alias**: `@/*` maps to `./src/*` in both apps

### Naming
- **Components**: PascalCase (`TimeTableSelector.tsx`)
- **Hooks**: camelCase with `use` prefix (`useSession.tsx`)
- **Contexts**: PascalCase with `Context` suffix (`SessionContext.tsx`)
- **API services**: camelCase with `Service` suffix (`authService.ts`)
- **Utility files**: camelCase (`dateUtils.ts`)

### Style
- Single quotes for strings
- Semicolons at end of statements
- Trailing commas in multi-line structures
- 2-space indentation
- Tailwind utility classes for styling; custom CSS only for complex components
- Use `cn()` utility for conditional class merging (never hand-merge Tailwind classes)

### Testing

**Runner**: `bun:test` only — never `node:test` or `node:assert`. Run with `bun run test` in `apps/backend`.

**Structure**:
- One top-level `describe` per file, named after the unit under test (e.g. `'courses routes'`), with `it` for each case — `it` and `test` are aliases in `bun:test`; use `it` for consistency.
- Use `expect` matchers (`toBe`, `toEqual`, `toMatch`), not `assert`.

**Backend route tests**:
- Group route tests by feature under `tests/interface/routes/` — `auth/`, `catalog/`, `users/`, …. The grouping is tests-side for now: `src/interface/routes/` still keeps catalog routes flat (`courses.routes.ts`, `faculties.routes.ts`), so don't expect a 1:1 mirror. Shared helpers live in `tests/interface/routes/support/` (not test files, so Bun does not run them).
- Drive the real app with `createApp().handle(request)` — no listener and no database. Fake repositories stand in for the database, so tests assert real HTTP behaviour: status codes, error bodies, and query validation.
- Reuse the shared helpers instead of re-declaring fixtures, config, or fakes:
  - `tests/interface/routes/support/catalog-test-utils.ts` — `COURSES`/`FACULTIES`, `createFakeCourseRepository`, `createFakeFacultyRepository`, `createCatalogApp()` → `{ app, get }`, `getCatalog`, `registerCatalogAuthGuard`, `UNAUTHORIZED_BODY`/`VALIDATION_ERROR_BODY`.
  - `tests/interface/routes/support/auth-test-utils.ts` — `TEST_USER`/`ADMIN`, `TEST_SESSION_TOKEN`, `createTestAuthConfig`, `createFakeIdentityProvider`/`createFakeUsers`/`createFakeSessions`/`createFakeDevAuthenticator`, `getCookie`.
- Do not hand-roll `new Request(...)` or copy fixtures/config/user/session fakes into a route test. When a new catalog route group lands (`course-units`, `occurrences`), add its fixtures and fake repository to `support/catalog-test-utils.ts` and default it in `createCatalogApp()`; add new auth fakes to `support/auth-test-utils.ts`.
- Call `registerCatalogAuthGuard` inside the file's `describe`.

```ts
import { describe, expect, it } from 'bun:test'

import { COURSES, createCatalogApp, registerCatalogAuthGuard } from '../support/catalog-test-utils'

const { app, get } = createCatalogApp()

describe('courses routes', () => {
  registerCatalogAuthGuard(app, ['/v1/courses', '/v1/courses/22841'])

  it('lists every course with the faculties that offer it', async () => {
    const { status, contentType, body } = await get('/v1/courses')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual(COURSES)
  })
})
```

## State Management

React Context API with `CombinedProvider` pattern:

- **SessionContext**: Auth state
- **ThemeContext**: Dark/light mode
- **MajorContext**: Available majors
- **CourseContext**: Picked courses
- **ScheduleContext**: Current schedule data
- **PreviewContext**: Preview mode state
- **CollabSessionContext**: Collaborative session state
- **CoursePickerContext / ClassSelectorContext**: Selection state

**Persistence split**:
- **localStorage**: Per-device settings (theme, language, locked toggles)
- **Backend**: Cross-device planner state (picked courses, class choices)

## Environment Setup

```bash
# 1. Clone and install
bun install

# 2. Start PostgreSQL
docker compose up -d --wait

# 3. Create env files
cp apps/backend/.env.schema apps/backend/.env
cp apps/frontend/.env.schema apps/frontend/.env

# 4. Set ADMIN_UP in backend .env to your NMEC

# 5. Initialize database
cd apps/backend
bun run contract:emit
bun run db:init
bun run db:seed:demo
cd ../..

# 6. Run
cd apps/backend && bun run dev   # Terminal 1
cd apps/frontend && bun run dev   # Terminal 2
```

## Critical Gotchas

### DO NOT

- **Do NOT modify `apps/backend/legacy/`** — deprecated Django code kept for reference only
- **Do NOT use Prettier or ESLint** — project uses Oxfmt and Oxlint
- **Do NOT follow Prisma 6/7 docs** — this project uses Prisma 8 (contract-first), a full rewrite. Read `apps/backend/docs/schema-migration.md` and load the `prisma-8` skill for guidance
- **Do NOT edit `packages/sigarra/src/generated/` by hand** — it is generated by Fern. Change `openapi.json` (or `scripts/patch-generated.ts`), then run `bun run generate` in `packages/sigarra` and commit the result. CI fails if the committed SDK is out of date
- **Do NOT edit `contract.json` or `contract.d.ts` directly** — they are git-ignored and generated. Edit `contract.prisma` then run `bun run contract:emit`
- **Do NOT run `db:seed` or `db:seed:demo` casually** — they truncate ALL tables
- **Do NOT add business logic to the interface layer** — keep routes thin, logic belongs in application layer
- **Do NOT use `node:test` or `node:assert`** — all backend tests run on `bun:test`
- **Do NOT duplicate fixtures or fake repositories in route tests** — extend `tests/interface/routes/support/catalog-test-utils.ts` or `support/auth-test-utils.ts` instead
- **Do NOT use `import.meta.env` for env vars in frontend** — use `ENV` from `varlock/env` for typed, validated access
- **Do NOT modify `apps/backend/docs/endpoints.md` unless adding/changing routes** — it is the single source of truth for API documentation

### Authentication

- **Dev login** is enabled by default in dev mode, forced off in production
- **Production auth** uses Sigarra OIDC (university SSO) — requires OIDC_CLIENT_ID and OIDC_CLIENT_SECRET
- **User roles** (USER/ADMIN/SUPERUSER) are assigned by seeding the database, never by logging in
- Set `ADMIN_UP` in backend `.env` to grant yourself admin access during development

### Frontend Notes

- **varlock** validates env vars at startup — invalid values will crash the app
- **Sentry** uses a tunnel through `/feedback` endpoint to avoid ad blockers — do not change this
- **Eden Treaty** generates the API client from Elysia routes — if you add backend endpoints, regenerate the frontend types

## Additional Documentation

- **API endpoints**: `apps/backend/docs/endpoints.md`
- **Tech stack**: `apps/backend/docs/tech-stack.md`
- **Database**: `apps/backend/docs/database.md`
- **Schema migrations**: `apps/backend/docs/schema-migration.md`
- **Contributing guide**: `.github/CONTRIBUTING.md`
