# TTS Backend Redo — Tech Stack

> Complete technology decisions for the Elysia + Prisma backend redo. All choices are optimized for a student team of 5-6 with first-year recruits, a 4-month deadline, and frontend-heavy experience.

---

## 1. Overview

| Layer           | Technology                 | Version  |
| --------------- | -------------------------- | -------- |
| Runtime         | Bun                        | 1.x      |
| Framework       | Elysia                     | 1.x      |
| ORM             | Prisma                     | 8.x      |
| Validation      | Zod                        | 3.x      |
| Email           | Resend                     | 4.x      |
| Auth            | SIGARRA OIDC (reused)      | —        |
| Database        | PostgreSQL                 | 16       |
| Package manager | Bun                        | built-in |
| Linting         | oxlint                     | 1.x      |
| Testing         | Bun test                   | built-in |
| CI/CD           | GitHub Actions             | —        |
| Deployment      | Docker Compose + nginx      | —        |
| Monitoring      | Sentry                     | —        |
| API docs        | Scalar                     | —        |

---

## 2. Runtime: Bun

**Why:** Elysia is built for Bun. You get:
- Native TypeScript support (no `ts-node` or `tsx`)
- Built-in test runner (`bun test`)
- Fast startup and hot reload
- Single-file execution (`bun run src/index.ts`)

**Tradeoff:** Some Node.js packages don't work. Avoid legacy SDKs (like Mailjet's). Use modern, `fetch`-based libraries.

> **Note:** The dev server runs via `tsx watch` (as configured in `package.json`). This works fine when running `bun run dev` in the monorepo. We may switch to native Bun (`bun --watch run src/index.ts`) in the future if all dependencies become fully Bun-compatible.

---

## 3. Framework: Elysia

**Why:**
- End-to-end type safety ( Eden Treaty )
- First-class Bun integration
- Built-in validation with `t.Object` (TypeBox)
- Plugin system for middleware
- Fast enough (500K req/s on Bun)

**Key patterns:**
- Use Elysia instances as route groups
- Use plugins for cross-cutting concerns (auth, rate limiting)
- Use `.handle()` for testing routes without HTTP

---

## 4. ORM: Prisma 8

> **This project uses Prisma 8** (contract-first, `@prisma/orm-postgres`), which is a full rewrite of Prisma 6/7. The setup, CLI commands, and client API are different. Do **not** follow Prisma 6/7 guides.

**Why:**
- Type-safe database access (generates TypeScript types from the contract)
- Migrations are versioned, content-hashed, and reviewable
- Works great with PostgreSQL

**How it works:**

Prisma 8 is *contract-first*. You write a `contract.prisma` file describing your models, run `contract emit` to generate the runtime artefacts, and then use the `db` client in your app. Migrations are planned from the diff between your contract and the database.

**Setup (already done in this repo):**

```
src/infrastructure/database/
├── contract.prisma   ← your schema, edit this
├── contract.json     ← generated, do not edit
├── contract.d.ts     ← generated, do not edit
├── prisma.ts         ← singleton client, import from here
└── repositories/     ← map Prisma rows to domain entities here
```

**First time:**
```bash
# 1. Write models in src/infrastructure/database/contract.prisma
# 2. Generate runtime artefacts
bun run contract:emit

# 3. Apply schema to DB and write the Prisma marker
bun run db:init
```

**Every schema change:**
```bash
bun run contract:emit                            # re-generate after editing contract.prisma
bun run migration:plan -- --name <slug>          # plan the migration
bun run migrate                                  # apply it
```

**The singleton client (`src/infrastructure/database/prisma.ts`):**
```typescript
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "./contract.d.ts";
import contractJson from "./contract.json" with { type: "json" };

export const db = process.env.DATABASE_URL
  ? postgres<Contract>({ contractJson, url: process.env.DATABASE_URL })
  : postgres<Contract>({ contractJson });
```

**Usage:**
```typescript
import { db } from "@/infrastructure/database/prisma";

// ORM lane — fully typed, model-shaped (models are PascalCase)
const users = await db.orm.public.User.select("id", "email").all();
const user  = await db.orm.public.User.create({ email: "alice@example.com" });

// SQL builder lane — typed SQL plans (keyed by TABLE name; ours are PascalCase)
const plan = db.sql.public.User
  .select("id", "email")
  .where((f, fns) => fns.eq(f.email, "alice@example.com"))
  .build();
const rows = await db.runtime().query(plan);
```

**Rules:**
- One `db` singleton exported from `src/infrastructure/database/prisma.ts`
- Never import `contract.json` or `contract.d.ts` directly outside `prisma.ts`
- Map `db` query results to domain entities in repositories — don't let Prisma types leak into `domain/`

> **Note — Prisma Studio in v8:** Prisma 8 doesn't ship its own Studio, but you can launch the Prisma 7 Studio pointed directly at your database via `bun run db:studio`. It spins up `prisma@prev studio --url $DATABASE_URL` under the hood and gives you the same visual inspector.

---

## 5. Validation: Zod

**Why:**
- Frontend devs already know it from form validation
- Composable schemas
- Great error messages
- TypeScript inference (`z.infer<typeof schema>`)

**Usage:**
```typescript
// interface/validators/exchange.ts
import { z } from 'zod'

export const CreateExchangeInput = z.object({
  items: z.array(z.object({
    courseUnitId: z.number().int().positive(),
    fromClassId: z.number().int().positive(),
    toClassId: z.number().int().positive(),
  })).min(1),
})

export type CreateExchangeInput = z.infer<typeof CreateExchangeInput>
```

**Rules:**
- Define schemas in `interface/validators/`
- Parse at the route boundary
- Pass typed data to use cases
- Don't use Zod inside domain entities (keep domain pure)

---

## 6. Email: Resend

**Why:**
- Modern TypeScript-first SDK
- Uses standard `fetch` — perfect for Bun
- Simple API: one endpoint, one method
- Free tier: 100 emails/day (plenty for exchange confirmations)

**Setup:**
```bash
bun add resend
```

```typescript
// lib/email.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendExchangeConfirmation(to: string, link: string) {
  await resend.emails.send({
    from: 'TTS <noreply@tts.niaefeup.pt>',
    to,
    subject: 'Confirmação de troca',
    html: `<p>Clica no link para confirmar a tua troca:</p><a href="${link}">${link}</a>`,
  })
}
```

**Domain setup:**
- Verify `tts.niaefeup.pt` in Resend dashboard
- Add DNS records (SPF, DKIM)
- Add `RESEND_API_KEY` to `.env`

**Migration from Mailjet:**
- Replace `MAILJET_API_KEY` + `MAILJET_SECRET_KEY` with `RESEND_API_KEY`
- Update `lib/email.ts` implementation
- Email templates and logic stay the same

---

## 7. Auth: SIGARRA OIDC (Reused)

**Why:**
- Students already have SIGARRA accounts
- No new passwords to manage
- University-approved identity provider

**Flow:**
1. User clicks "Login with SIGARRA"
2. Redirect to SIGARRA authorization endpoint
3. SIGARRA redirects back with authorization code
4. Backend exchanges code for tokens
5. Backend creates session (HTTP-only cookie or JWT)

**Implementation options:**

| Option | Complexity | Recommendation |
|--------|-----------|----------------|
| Manual OIDC flow | Low | **Recommended** — ~50 lines, no extra deps |
| `openid-client` | Medium | Good if you need more OIDC features |
| `better-auth` | Medium | Overkill for just OIDC |

**Manual implementation:**
```typescript
// interface/middleware/auth.ts
import { Elysia } from 'elysia'

export const authMiddleware = new Elysia({ name: 'auth' })
  .derive(({ request }) => {
    // Extract token from cookie or Authorization header
    // Validate with SIGARRA's token endpoint
    // Return user info or throw 401
  })
```

**Environment variables:**
```env
SIGARRA_CLIENT_ID=your-client-id
SIGARRA_CLIENT_SECRET=your-client-secret
SIGARRA_REDIRECT_URI=https://tts.niaefeup.pt/api/v1/auth/callback
SIGARRA_AUTH_ENDPOINT=https://open-id.up.pt/realms/sigarra/protocol/openid-connect/auth
SIGARRA_TOKEN_ENDPOINT=https://open-id.up.pt/realms/sigarra/protocol/openid-connect/token
SIGARRA_USERINFO_ENDPOINT=https://open-id.up.pt/realms/sigarra/protocol/openid-connect/userinfo
```

---

## 8. Database: PostgreSQL

**Why:**
- Production-grade, reliable
- JSONB support for flexible data
- Row-level security if needed
- Works great with Prisma

**Hosting options:**

| Provider | Free tier | Notes |
|----------|-----------|-------|
| **Supabase** | 500MB | Generous free tier, real-time features |
| **Neon** | 0.5GB | Serverless, scales to zero |
| **Prisma Postgres** | Free tier | Managed by Prisma, zero-config with Prisma 8 |
| **Self-hosted (Docker)** | — | Works with any Docker-compatible host |

> **Current dev setup:** The repo is already wired to a hosted Prisma Postgres instance (`db.prisma.io`) via `DATABASE_URL` in `.env`. This can stay for dev or be swapped for any PostgreSQL provider — Prisma 8 works with any standard PostgreSQL >= 15.

**Development (local alternative):**
- Use Docker Compose for local PostgreSQL
- Or use any of the hosted providers above for dev

```yaml
# docker-compose.yaml (repo root) — host port 5434 avoids clashing with a
# locally installed PostgreSQL on 5432; bound to loopback so dev credentials
# are not exposed on the network.
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: tts
      POSTGRES_PASSWORD: tts
      POSTGRES_DB: tts
    ports:
      - "127.0.0.1:5434:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

---

## 9. API Style: REST (with Elysia)

**Why REST over tRPC:**
- Simpler to debug (just HTTP)
- Works with any client (not just TypeScript)
- Easier for first-year students to understand
- No codegen step

**If you prefer tRPC later:** Elysia has a tRPC adapter. You can migrate after launch.

**Conventions:**
- Declare all routes under `/v1/` — the `/api` prefix seen in public URLs is added by the deployment (Niployments), not the app
- Use standard HTTP methods (GET, POST, PUT, DELETE)
- Return consistent error format: `{ error: string, code: string }`
- Paginate list endpoints with `?page=1&limit=20`

---

## 10. Testing: Bun Test

**Why:**
- Built into Bun, no extra config
- Jest-compatible API (familiar to frontend devs)
- Fast

**Structure:** tests mirror `src/` and live under `apps/backend/tests/`. Route tests drive the real app through `createApp().handle(request)` with fake repositories — no listener and no database.

```
tests/
├── app/
│   └── main.test.ts                    # composition root
├── core/
│   └── nmec.test.ts                    # pure helpers
├── frontend-integration.test.ts        # cross-origin/CORS regression guard
└── interface/
    ├── middleware/
    │   └── error-handler.test.ts
    ├── plugins/
    │   └── openapi.test.ts
    └── routes/
        ├── support/                    # shared helpers, not test suites
        │   ├── auth-test-utils.ts      # test user, config, session/IdP fakes
        │   └── catalog-test-utils.ts   # catalog fixtures, fake repos, createCatalogApp()
        ├── auth/
        │   ├── auth.routes.test.ts
        │   └── auth-compat.routes.test.ts
        ├── catalog/
        │   ├── courses.test.ts
        │   ├── faculties.test.ts
        │   ├── course-units.test.ts
        │   └── occurrences.test.ts     # planned
        └── ...                         # one folder per route group (users, exchanges, admin, …)
```

Route tests are grouped by feature under `tests/interface/routes/`. That grouping is ahead of `src/interface/routes/`, which still keeps catalog routes flat (`courses.routes.ts`, `faculties.routes.ts`), so don't read the two trees as a 1:1 mirror. Shared fixtures and fakes go in `support/` (files are not named `*.test.ts`, so Bun never runs them as suites). One `describe` per file, `it` per case.

**Example:**
```typescript
// tests/interface/routes/catalog/courses.test.ts
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

Full conventions — runner, structure, shared helpers, and what not to duplicate — live in `AGENTS.md` → Testing.

**Scripts:**
```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage"
  }
}
```

---

## 11. CI/CD: GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - run: bun install --frozen-lockfile

      - run: bun run lint

      - run: bun run typecheck

      - run: bun run test

      - run: bun run build
```

**Required scripts in `package.json`:**
```json
{
  "scripts": {
    "dev": "tsx watch --env-file .env src/main.ts",
    "build": "bun build src/main.ts --outfile dist/server.mjs --target=node",
    "start": "node dist/server.mjs",
    "lint": "oxlint .",
    "lint:fix": "oxlint . --fix",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "contract:emit": "prisma contract emit",
    "db:init": "prisma db init",
    "db:update": "prisma db update",
    "migrate": "prisma db migrate",
    "migration:plan": "prisma migration plan"
  }
}
```

---

## 12. Deployment: Docker + nginx

We deploy using Docker Compose, with nginx handling TLS termination and reverse proxying. The exact service configuration will evolve as needed — keep it minimal and avoid over-specifying implementation details at this stage.

**Services:**

| Service | Image | Purpose |
|---------|-------|---------|
| `nginx` | `nginx:1-alpine` | TLS termination, reverse proxy on port 443 |
| `backend` | Custom Bun image | Elysia API server |
| `postgres` | `postgres:16` | Database |
| `redis` | `redis:6.2-bullseye` | Caching, sessions |
| `mailpit` | `axllent/mailpit` | Local email testing (dev only) |

**Dockerfile (multi-stage):**
```dockerfile
# deps
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# build
FROM deps AS build
COPY . .
RUN bun run build

# prod
FROM oven/bun:1-slim AS prod
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
CMD ["bun", "run", "dist/main.js"]
```

**docker-compose.yaml:**
```yaml
services:
  nginx:
    image: nginx:1-alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/certs/:/etc/nginx/certs/
    depends_on:
      - backend

  backend:
    build:
      context: .
      target: prod
    env_file:
      - .env
    environment:
      - DATABASE_URL=postgresql://tts:tts@postgres:5432/tts
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: tts
      POSTGRES_PASSWORD: tts
      POSTGRES_DB: tts
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:6.2-bullseye

  mailpit:
    image: axllent/mailpit
    ports:
      - "1025:1025"
      - "8025:8025"
    profiles: ["dev"]

volumes:
  pgdata:
```

**nginx.conf (simplified):**
```nginx
server {
    listen 443 ssl;
    server_name tts.niaefeup.pt;

    ssl_certificate /etc/nginx/certs/cert.pem;
    ssl_certificate_key /etc/nginx/certs/key.pem;

    location / {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Environment variables in production:**
```env
DATABASE_URL=postgresql://tts:tts@postgres:5432/tts
REDIS_URL=redis://redis:6379
RESEND_API_KEY=re_...
SIGARRA_CLIENT_ID=...
SIGARRA_CLIENT_SECRET=...
JWT_SECRET=...
PORT=3000
```

---

## 13. Monitoring: Sentry

**Why:**
- Free for open source projects
- Easy Bun integration
- Error tracking with stack traces
- Performance monitoring

**Setup:**
```bash
bun add @sentry/bun
```

```typescript
// main.ts
import * as Sentry from '@sentry/bun'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
})
```

---

## 14. API Documentation: Scalar

**Why:**
- Modern, fast, beautiful
- Auto-generated from Elysia routes
- Interactive playground

**Setup:**
```bash
bun add @elysiajs/swagger
```

```typescript
// main.ts
import { swagger } from '@elysiajs/swagger'

app.use(swagger({
  path: '/docs',
  documentation: {
    info: {
      title: 'TTS API',
      version: '1.0.0',
    },
  },
}))
```

---

## 15. Project Structure (Clean Architecture)

See [TTS Backend Redo - Proposed Structure.md](./TTS%20Backend%20Redo%20-%20Proposed%20Structure.md) for the full folder structure and layer responsibilities.

---

## 16. Environment Variables

Environment variables are declared and validated by [varlock](https://varlock.dev) in [`.env.schema`](../../.env.schema). The schema is the source of truth; local overrides go in a git-ignored `.env` (or `.env.local`) next to the schema.

Current schema (excerpt):

```env
# Port the Elysia server listens on
# @public
# @type=port
PORT=3000

# PostgreSQL connection string (requires PostgreSQL >= 15)
# @required @sensitive
# @type=url(prependHttps=false)
DATABASE_URL=
```

Additional variables (e.g. SIGARRA OIDC, Resend, Sentry) will be added to the schema as those features are implemented.

---

## 17. Package.json

The current manifest (kept in sync — the sections above list what gets added when each feature lands: `zod`, `resend`, `@sentry/bun`, `@elysiajs/swagger`):

```json
{
  "name": "tts-be",
  "private": true,
  "packageManager": "bun@1.4.1",
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file .env src/main.ts",
    "build": "bun build src/main.ts --outfile dist/server.mjs --target=node",
    "start": "node dist/server.mjs",
    "lint": "oxlint .",
    "lint:fix": "oxlint . --fix",
    "typecheck": "tsc --noEmit",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "contract:emit": "prisma contract emit",
    "db:init": "prisma db init",
    "db:update": "prisma db update",
    "db:verify": "prisma db verify",
    "db:schema": "prisma db schema",
    "db:sign": "prisma db sign",
    "db:studio": "node -e \"require('dotenv').config(); const r = require('child_process').spawnSync('bun', ['x','--yes','prisma@prev','studio','--port','5555','--url',process.env.DATABASE_URL], {stdio:'inherit', cwd:'..'}); process.exit(r.status ?? 1)\"",
    "migrate": "prisma db migrate",
    "migrate:show": "prisma db migrate --show",
    "migration:plan": "prisma migration plan",
    "migration:show": "prisma migration show",
    "migration:status": "prisma migration status",
    "migration:list": "prisma migration list",
    "migration:ref:set": "prisma migration ref set"
  },
  "dependencies": {
    "@elysiajs/cors": "^1.4.2",
    "@elysiajs/node": "^1.4.5",
    "@prisma/orm-postgres": "8.0.0-rc.17",
    "elysia": "^1.4.28",
    "temporal-polyfill": "^1.0.4"
  },
  "devDependencies": {
    "@types/node": "^25.6.2",
    "dotenv": "^16.0.0",
    "oxlint": "^1.86.0",
    "prisma": "8.0.0-rc.22",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

---

## 18. What We Reuse from the Old System

| Component | Reuse | Notes |
|-----------|-------|-------|
| SIGARRA OIDC | Yes | Same auth flow, new implementation |
| Email templates | Yes | Adapt HTML to Resend |
| Exchange validation logic | Yes | Port `exchange_overlap()` to domain layer |
| Admin panel frontend | Partially | API calls will change |
| Database data | Yes | Migrate with a script |
| Prisma schema | No | New unified schema written in `contract.prisma` |

---

## 19. What's Deliberately Excluded

| Component | Reason |
|-----------|--------|
| Redis | Not needed yet. Add if you need distributed caching or rate limiting. |
| Message queue | Not needed yet. Fire-and-forget emails are fine for now. |
| tRPC | REST is simpler. Can migrate later if needed. |
| Over-engineered infra | We use Docker Compose + nginx for deployment. Keep deployment configuration pragmatic and minimal. |
| Feature flags | Not needed for a fresh launch. Add if you need gradual rollout. |

---

## 20. Summary

| Decision | Choice | Why |
|----------|--------|-----|
| Runtime | Bun | Elysia's native runtime, fast, built-in test runner |
| Framework | Elysia | Type-safe, Bun-native, simple |
| ORM | Prisma 8 | Contract-first, type-safe, versioned migrations |
| Validation | Zod | Frontend devs know it, great errors |
| Email | Resend | Modern, simple, Bun-compatible |
| Auth | SIGARRA OIDC | Reuse existing university auth |
| Database | PostgreSQL | Production-grade, JSONB, reliable |
| Testing | Bun test | Built-in, fast, familiar API |
| Deployment | Docker Compose + nginx | Containerized deployment with nginx for TLS termination |
| Monitoring | Sentry | Free for open source, easy setup |
| API docs | Scalar | Auto-generated, beautiful |

---

*Document written for the TTS backend redo. Last updated: September 2026.*
