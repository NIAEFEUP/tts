# Contributing to TTS

Thank you for contributing to **[TTS — Time Table Selector](https://tts.niaefeup.pt)**, developed and maintained by [NIAEFEUP](https://ni.fe.up.pt).

---

## Table of Contents

- [Before You Start](#before-you-start)
- [Repository Structure](#repository-structure)
- [Workflow Overview](#workflow-overview)
- [Milestones & Issues](#milestones--issues)
- [Branching](#branching)
- [Commits](#commits)
- [Opening a Pull Request](#opening-a-pull-request)
- [Code Standards](#code-standards)
- [Useful Commands](#useful-commands)
- [Getting Help](#getting-help)

---

## Before You Start

- Read the **[README](../README.md)** — it covers the full setup, the monorepo layout, authentication, and troubleshooting.
- Make sure your local environment runs before starting. You should be able to run both `apps/backend` and `apps/frontend` locally.
- **Never target `main` directly with a PR.** All work flows through milestone branches into `develop`.

---

## Repository Structure

This is a **Bun workspace monorepo** with two apps:

| Path            | Stack                   | Dev URL               |
| --------------- | ----------------------- | --------------------- |
| `apps/backend`  | Bun + Elysia + Prisma 8 | http://localhost:3000 |
| `apps/frontend` | React + Vite + Tailwind | http://localhost:3100 |

The legacy Django backend lives in `apps/backend/legacy/` and is no longer actively developed.

```
.
├── apps/
│   ├── backend/          # Bun + Elysia + Prisma 8 API
│   │   ├── src/
│   │   │   ├── application/   # Use-cases (business logic)
│   │   │   ├── core/          # Auth, config, utils
│   │   │   ├── domain/        # Entities, ports, value objects
│   │   │   ├── infrastructure/ # Database, external services
│   │   │   └── interface/     # Routes, middleware, validators
│   │   ├── docs/              # API docs (endpoints.md, tech-stack.md)
│   │   ├── legacy/            # Old Django backend (deprecated)
│   │   └── .env.schema        # Env vars with defaults (varlock)
│   └── frontend/         # React + Vite SPA
│       ├── src/
│       └── .env.schema        # Env vars with defaults (varlock)
├── docker-compose.yaml   # PostgreSQL for local dev
└── package.json          # Workspace root (lint, format, scripts)
```

---

## Workflow Overview

```
Find an issue → get assigned by PM → branch from milestone branch
     → implement → PR into milestone branch → review → merge
                                                          ↓
                              milestone branch → develop (when milestone is stable)
                                                          ↓
                                               develop → main (release)
```

1. **Find an issue** in the issue tracker. If your idea doesn't have one, open it first so it can be discussed and prioritised.
2. **Get assigned** — the **project manager assigns issues**. Do not self-assign. Comment on the issue or ask in the team channel to be assigned.
3. **Identify the milestone branch** for your issue (e.g. `feature/exchange`, `feature/collaborative-sessions`). This is the branch your PR will target.
4. **Branch** from that milestone branch using the naming convention below.
5. **Implement**, keeping commits small and descriptive.
6. **Open a PR** targeting the **milestone branch** — not `develop`, not `main`.
7. Fill the PR template: link the issue (`Closes #<number>`), assign the milestone and a reviewer.
8. **Address feedback**, then merge once approved.
9. Coordinators merge milestone branches into `develop` when the milestone is considered stable.

---

## Milestones & Issues

Every PR **must** be linked to:

- **An issue** — use `Closes #<number>` (or `Fixes`/`Resolves`) in the PR description. GitHub will close the issue automatically on merge.
- **A milestone** — assign the PR (and the issue) to the relevant milestone in the sidebar.

### Active Milestones & Their Branches

| Milestone      | Branch to target |
| -------------- | ---------------- |
| Backend Remake | `monorepo`       |

> If your work doesn't fit any milestone, discuss with a coordinator before creating a new one. Those PRs may target `develop` directly.

### Issue Labels

> Most of these labels are specific to the current main milestone (Backend Remake)

| Label              | Meaning                      |
| ------------------ | ---------------------------- |
| `backend`          | Backend endpoint / feature   |
| `frontend`         | Frontend API migration       |
| `infra`            | Infrastructure / integration |
| `good first issue` | Good for newcomers           |
| `blocked`          | Waiting on another issue     |
| `T1`               | Read-only / simple CRUD      |
| `T2`               | Writes / mutations           |
| `T3`               | Complex domain / admin       |
| `week-1`           | Assign in first week         |
| `week-2`           | Assign in second week        |
| `week-3`           | Assign in third week         |
| `cutover`          | Final integration / cutover  |

---

## Branching

Branch **from the milestone branch** (see table above). Use this naming convention:

```text
<your-name>/<issue-number>-<short-description>
```

> **Note:** Avoid using `#` in branch names, as it causes syntax conflicts in shell environments (Bash / Zsh).

**Examples:**

```bash
# Frontend UI task
git checkout -b francisca/499-fix-navbar-overflow

# Backend endpoint task
git checkout -b pedro/512-add-sessions-endpoint

# Full-stack task
git checkout -b francisca/530-exchange-filter-fullstack
```

## Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/) standard:

```text
<type>(<scope>): <imperative description>
```

### Commit Types

| Type       | Use Case                                          |
| :--------- | :------------------------------------------------ |
| `feat`     | A new user-facing feature or backend endpoint     |
| `fix`      | A bug fix                                         |
| `refactor` | Code restructuring without changing behavior      |
| `style`    | Formatting, CSS changes with no logic alterations |
| `chore`    | Build tasks, package updates, configuration       |
| `docs`     | Documentation changes only                        |
| `test`     | Adding or updating tests                          |


### Scopes

Use scopes to indicate which part of the monorepo is affected:
- `fe`: Changes isolated to the frontend app.
- `be`: Changes isolated to the backend service.
- `api` / `db`: API route changes, migrations, or database queries.
- `deps` / `ci`: Dependencies, Docker, or GitHub Actions.

> **Scope Disclaimer**: Scopes are optional. If a change affects the entire repository (such as root configuration, tooling) or does not cleanly belong to any specific domain (e.g., updating general documentation), omit the scope entirely (e.g., docs: update contributing guide).

**Examples:**

```text
feat(be): add session invitation route and validation
feat(fe): add invitation acceptance modal
fix(fe): adjust mobile timetable grid scrolling
chore(deps): bump vite to 5.4.0
fix(db): correct foreign key constraint on exchange requests
```

- Write in the **imperative, present tense** ("add" instead of "added" or "adds").
- Keep the subject line concise (under 72 characters).

---

## Pull Request Workflow

### 1. Open as a Draft Early
Open your PR as a **Draft** as soon as your first commit is pushed.
* Draft PRs provide visibility into ongoing work without triggering review notifications.
* Link the issue in the description using `Closes #<number>` (or `Fixes #<number>`).

### 2. PR Review & Reviewers
* Code owners (`@franpts2` and `@PedroLunet`) are automatically assigned when your PR is marked ready.
* For full-stack PRs, ensure you describe both frontend and backend testing steps.

### 3. Making it Ready for Review
Before clicking **Ready for Review**:
- [ ] Ensure your branch is rebased / up-to-date with your target branch.
- [ ] Verify there are no merge conflicts.
- [ ] Run both frontend and backend lint/test checks locally.
- [ ] For UI changes, attach screenshots or recordings.
- [ ] For backend/API changes, provide sample request/response payloads or describe migration steps.

### PR Size Guidelines

| Size   | Lines changed | Expectation             |
| ------ | ------------- | ----------------------- |
| Small  | < 100         | Fast review, same day   |
| Medium | 100–400       | Review within 2 days    |
| Large  | > 400         | Break it up if possible |

---

## Code Standards

### Backend Architecture

The backend follows a **domain-driven layered** pattern:

```
interface/       ← HTTP routes, middleware, validators (thin)
application/     ← Use-cases — orchestrate business logic
domain/          ← Entities, ports (interfaces), value objects
infrastructure/  ← Database repositories, external service adapters
```

- **Routes** should be thin — delegate all logic to use-cases.
- **Use-cases** own business logic, calculations, and rules.
- **Domain** defines entities and ports (interfaces) — no framework dependencies.
- **Infrastructure** implements ports and contains framework-specific code.

### Backend / TypeScript

- Follow the project's `oxlint` and `oxfmt` configuration — run `bun run lint` and `bun run format` from the repo root.
- Use the Prisma client (`db` from `infrastructure/database/prisma.ts`) — avoid raw SQL unless strictly necessary.
- After editing `contract.prisma`, **always** run `bun run contract:emit` in `apps/backend`. The generated `contract.json` and `contract.d.ts` are git-ignored.
- New API endpoints must follow existing naming patterns in `src/interface/routes/`.
- Document new endpoints in `apps/backend/docs/endpoints.md`.

### Frontend / React

- Use functional components with hooks — no class components.
- Use the project's design system (shadcn/ui components in `components/ui/`).
- Read environment variables through varlock's typed `ENV` object (`import { ENV } from 'varlock/env'`), not `import.meta.env`.
- Only `VITE_`-prefixed variables are exposed to the browser.
- Use SWR for data fetching and socket.io-client for real-time features.

### Tests

- **Backend**: Add or update tests in `apps/backend/tests/`. Run with `bun run test`.
- **Frontend**: Add or update tests in `apps/frontend/src/` (co-located `.test.tsx` files). Run with `bun run test`.
- Backend test layout, shared helpers, and conventions: see [tech-stack.md §10 Testing](../apps/backend/docs/tech-stack.md#10-testing-bun-test) and [AGENTS.md § Testing](../AGENTS.md#testing).
- Run the test suite before pushing.

### Do's and Don'ts

| Do                               | Don't                                         |
| -------------------------------- | --------------------------------------------- |
| Keep routes thin                 | Put business logic in routes                  |
| Use use-cases for business logic | Duplicate logic across routes                 |
| Write tests for logic changes    | Change schema without re-emitting contract    |
| Use varlock `ENV` for config     | Hard-code environment values                  |
| Follow existing patterns         | Introduce new abstractions without discussion |

---

## Useful Commands

```bash
# repo root
bun install              # install all workspace dependencies
bun run lint             # lint all apps (oxlint)
bun run lint:fix         # lint + auto-fix
bun run format           # format all apps (oxfmt)
bun run format:check     # check formatting

# backend (apps/backend)
bun run dev              # start dev server with hot reload
bun run start            # start production server
bun run test             # run tests
bun run typecheck        # emit contract + typecheck
bun run contract:emit    # generate Prisma contract (required after schema changes)
bun run db:init          # create database tables (empty DB only)
bun run db:seed          # seed catalog only
bun run db:seed:demo     # seed catalog + demo data (makes ADMIN_UP an admin)
bun run db:studio        # open Prisma Studio
bun run migration:plan -- --name <slug>  # plan a migration
bun run migrate          # apply migrations

# frontend (apps/frontend)
bun run dev              # start Vite dev server
bun run build            # typecheck + build
bun run typecheck        # typecheck only
bun run preview          # preview production build

# docker (from the repo root)
docker compose up -d --wait   # start PostgreSQL
docker compose down           # stop (keeps data)
docker compose down -v        # stop and wipe data

# app images (from the repo root)
docker build --target backend-prod  -t tts-be .
docker build --target frontend-prod -t tts-fe .
```

---

## Getting Help

- Check the [README](../README.md) and [backend docs](../apps/backend/docs/) first.
- Ask in the team channel.
- Comment on the relevant issue.
