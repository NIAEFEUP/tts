# TTS Backend Cutover — Complete GitHub Issues Guide

This document contains **copy-paste-ready GitHub issue descriptions** for every task required to make the TTS website fully functional on the new Elysia backend.

**Total issues:** 45  
**Backend:** 28 · **Frontend:** 12 · **Infrastructure:** 5

---

## How to use this guide

1. Copy the **Title**, **Description**, and **Acceptance Criteria** sections into a new GitHub issue.
2. Apply the suggested **labels** and **milestone**.
3. Link the **dependencies** using GitHub’s "Blocked by" field or by mentioning them in the description.
4. Assign based on the **suggested owner**.

---

## Labels reference

Create these labels in GitHub before opening issues:

| Label              | Color     | Meaning                      |
| ------------------ | --------- | ---------------------------- |
| `backend`          | `#0052CC` | Backend endpoint / feature   |
| `frontend`         | `#7057FF` | Frontend API migration       |
| `infra`            | `#6E6E6E` | Infrastructure / integration |
| `good first issue` | `#7057FF` | Good for newcomers           |
| `blocked`          | `#B60205` | Waiting on another issue     |
| `T1`               | `#0E8A16` | Read-only / simple CRUD      |
| `T2`               | `#FBCA04` | Writes / mutations           |
| `T3`               | `#D93F0B` | Complex domain / admin       |
| `week-1`           | `#C2E0C6` | Assign in first week         |
| `week-2`           | `#FEF2C0` | Assign in second week        |
| `week-3`           | `#F9D0C4` | Assign in third week         |
| `cutover`          | `#5319E7` | Final integration / cutover  |

---

## Infrastructure issues (foundation)

### Issue I-1 — Backend foundation and reference implementation

**Labels:** `backend`, `infra`, `T2`  
**Milestone:** Foundation  
**Estimate:** 4–6 days  
**Suggested owner:** Backend dev #1 + Backend dev #2  
**Blocked by:** —

#### Description

Before any endpoint work can begin, the backend needs a working skeleton and one complete reference feature. This issue sets the patterns that all other backend issues will follow.

Implement:

- Auth middleware: extract session cookie and expose `user` on Elysia context
- Consistent error format: `{ error: string, code: string }`
- Pagination and base response helpers
- Reference implementation for `GET /api/v1/faculties`, `GET /api/v1/faculties/:acronym`, `GET /api/v1/faculties/:acronym/courses`
- Integration test pattern using `createApp().handle(...)`
- Seeded dev data for at least `Faculty`, `Course`, `FacultyCourse`, `User`
- Backend issue template

#### Acceptance criteria

- [ ] `GET /api/v1/faculties` returns a list of faculties
- [ ] `GET /api/v1/faculties/:acronym` returns a single faculty
- [ ] `GET /api/v1/faculties/:acronym/courses` returns courses for a faculty
- [ ] Auth middleware exposes `user` on context for authenticated routes
- [ ] Errors return `{ error, code }`
- [ ] At least one integration test exists and passes
- [ ] Dev seed script runs successfully
- [ ] Backend issue template is created in `.github/ISSUE_TEMPLATE/backend.md`

---

### Issue I-2 — Frontend environment config for new backend

**Labels:** `frontend`, `infra`, `T1`  
**Milestone:** Foundation  
**Estimate:** 1–2 days  
**Suggested owner:** Backend dev #1 + one frontend dev  
**Blocked by:** I-1

#### Description

Configure the frontend to talk to the new Elysia backend during development and in production. This is required before any frontend migration issue can be worked on.

#### Acceptance criteria

- [ ] `VITE_APP_BACKEND_URL` can be pointed at the new backend
- [ ] CORS allows frontend origin on new backend
- [ ] Session cookies work across origins in dev
- [ ] Frontend can reach `GET /health` on new backend
- [ ] Dev and prod config files updated

---

### Issue I-3 — Data migration from legacy Django database

**Labels:** `backend`, `infra`, `T3`  
**Milestone:** Foundation  
**Estimate:** 5–8 days  
**Suggested owner:** Backend dev #2  
**Blocked by:** I-1

#### Description

Migrate existing data from the legacy Django database into the new Prisma schema. This is required before any feature that reads historical user state (schedule, enrollments, exchanges) can work correctly.

#### Acceptance criteria

- [ ] Users migrated (shadow rows created for legacy participants without accounts)
- [ ] Catalog migrated: faculties, courses, course units, occurrences, classes, slots, professors
- [ ] Enrollments migrated
- [ ] Exchange requests and items migrated
- [ ] Admin scopes migrated
- [ ] Duplicate direct-exchange items resolved
- [ ] Course/unit period collisions resolved
- [ ] Migration is idempotent and reproducible

---

## Backend Phase 1 — Read-only catalog & student state (week 1)

These 16 issues depend only on **I-1** and can be assigned in parallel.

### Issue B-1 — Browse faculties

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 1–2 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in user should be able to see all faculties and a single faculty’s details.

**Spec:** `apps/backend/docs/endpoints.md` §2

#### Acceptance criteria

- [ ] `GET /api/v1/faculties` lists all faculties
- [ ] `GET /api/v1/faculties/:acronym` returns a single faculty
- [ ] Returns 404 for unknown acronym
- [ ] Response shape matches the spec
- [ ] Integration tests for list and 404 cases

---

### Issue B-2 — Browse courses

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 2–3 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in user should be able to browse courses, optionally filtered by faculty and academic year.

**Spec:** `apps/backend/docs/endpoints.md` §3

#### Acceptance criteria

- [ ] `GET /api/v1/faculties/:acronym/courses` returns courses for a faculty
- [ ] `GET /api/v1/courses` supports `year` and `faculty` query params
- [ ] `GET /api/v1/courses/:id` returns a single course
- [ ] Course objects include `faculties: string[]`
- [ ] Returns 404 for unknown course
- [ ] Integration tests

---

### Issue B-3 — View abstract course units

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 2–3 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in user should be able to see the abstract course units belonging to a course, a single unit’s details, and the occurrences where that unit is taught.

**Spec:** `apps/backend/docs/endpoints.md` §4

#### Acceptance criteria

- [ ] `GET /api/v1/courses/:id/units` lists units for a course
- [ ] `GET /api/v1/course-units/:id` returns a single unit
- [ ] `GET /api/v1/course-units/:id/occurrences` lists occurrences of the unit
- [ ] Returns 404 for unknown resources
- [ ] Integration tests

---

### Issue B-4 — View course occurrences

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 2–3 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in user should be able to see concrete occurrences of a course for a given academic year and semester, and view a single occurrence’s details.

**Spec:** `apps/backend/docs/endpoints.md` §5

#### Acceptance criteria

- [ ] `GET /api/v1/courses/:id/occurrences` supports `year` and `semester` query params
- [ ] `GET /api/v1/occurrences/:id` returns a single occurrence
- [ ] Composite PK `(id, year)` handled correctly
- [ ] Integration tests

---

### Issue B-5 — View classes for an occurrence

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 2–3 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in user should be able to see the classes for an occurrence, inspect a single class, and (if admin) see the students enrolled in a class.

**Spec:** `apps/backend/docs/endpoints.md` §5, §6

#### Acceptance criteria

- [ ] `GET /api/v1/occurrences/:id/classes` returns classes with slots and professors
- [ ] `GET /api/v1/classes/:id` returns class detail
- [ ] `GET /api/v1/classes/:id/students` is admin-scoped
- [ ] Response shape matches `CourseInfo` / `ClassInfo`
- [ ] Integration tests

---

### Issue B-6 — View schedule slots

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 2–3 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in user should be able to inspect schedule slots for an occurrence, a single slot, and the professors assigned to that slot.

**Spec:** `apps/backend/docs/endpoints.md` §6

#### Acceptance criteria

- [ ] `GET /api/v1/occurrences/:id/slots` lists slots for an occurrence
- [ ] `GET /api/v1/slots/:id` returns a single slot
- [ ] `GET /api/v1/slots/:id/professors` returns assigned professors
- [ ] Shared slots (one slot → many classes via `SlotClass`) represented correctly
- [ ] Integration tests

---

### Issue B-7 — Verify occurrence hashes

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 1–2 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

The frontend needs a batch endpoint to verify whether occurrence data has changed by comparing hashes.

**Spec:** `apps/backend/docs/endpoints.md` §5

#### Acceptance criteria

- [ ] `GET /api/v1/occurrences/hashes` accepts a list of occurrence IDs
- [ ] Returns `{ occurrenceId, year, hash }` for each requested ID
- [ ] Integration tests

---

### Issue B-8 — View exchange periods

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 2–3 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in user should be able to see when exchanges are open for a specific occurrence or for a course.

**Spec:** `apps/backend/docs/endpoints.md` §5, §3

#### Acceptance criteria

- [ ] `GET /api/v1/occurrences/:id/periods` lists periods for an occurrence
- [ ] `GET /api/v1/courses/:id/periods` lists periods derived from all occurrences
- [ ] Integration tests

---

### Issue B-9 — Current user profile

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 1–2 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in user should be able to retrieve their own profile. Both `/auth/me` and `/users/me` should return the same data.

**Spec:** `apps/backend/docs/endpoints.md` §1, §7

#### Acceptance criteria

- [ ] `GET /api/v1/auth/me` returns current user profile
- [ ] `GET /api/v1/users/me` returns the same profile
- [ ] Requires authentication (401 otherwise)
- [ ] Integration tests

---

### Issue B-10 — View my schedule

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 2–3 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in student should be able to see their current class schedule derived from their enrollments.

**Spec:** `apps/backend/docs/endpoints.md` §7

#### Acceptance criteria

- [ ] `GET /api/v1/users/me/schedule` returns current user’s schedule
- [ ] Requires authentication
- [ ] Tests use seeded student + enrollments

---

### Issue B-11 — Refresh my schedule from Sigarra

**Labels:** `backend`, `T2`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 3–4 days  
**Suggested owner:** Junior backend-capable member  
**Blocked by:** I-1

#### Description

A logged-in student should be able to resync their schedule and enrollments from Sigarra.

**Spec:** `apps/backend/docs/endpoints.md` §7

#### Acceptance criteria

- [ ] `PUT /api/v1/users/me/schedule/refresh` calls Sigarra adapter or dev mock
- [ ] Updates `Enrollment` rows for current user
- [ ] Safe to call multiple times
- [ ] Requires authentication
- [ ] Tests using dev mock

---

### Issue B-12 — View my enrollments

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 2–3 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in student should be able to see which classes they are enrolled in.

**Spec:** `apps/backend/docs/endpoints.md` §7

#### Acceptance criteria

- [ ] `GET /api/v1/users/me/enrollments` returns enrollment list
- [ ] Includes occurrence and class info
- [ ] Requires authentication
- [ ] Integration tests

---

### Issue B-13 — View my eligible occurrences

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 2–3 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in student should be able to see which occurrences they are eligible to take or exchange into.

**Spec:** `apps/backend/docs/endpoints.md` §7

#### Acceptance criteria

- [ ] `GET /api/v1/users/me/eligible-occurrences` returns eligible occurrences
- [ ] Requires authentication
- [ ] Integration tests

---

### Issue B-14 — Persist planner state across devices

**Labels:** `backend`, `T1`, `T2`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 3–4 days  
**Suggested owner:** Junior backend-capable member  
**Blocked by:** I-1

#### Description

A logged-in student should be able to save, retrieve, and delete their planner draft per academic year.

**Spec:** `apps/backend/docs/endpoints.md` §8

#### Acceptance criteria

- [ ] `GET /api/v1/users/me/planner-state` returns default-year state
- [ ] `GET /api/v1/users/me/planner-state/:year` returns state for a year
- [ ] `PUT /api/v1/users/me/planner-state/:year` saves planner blob + schema version
- [ ] `DELETE /api/v1/users/me/planner-state/:year` clears state
- [ ] `updatedAt` bumped on write
- [ ] Requires authentication
- [ ] Integration tests

---

### Issue B-15 — View my exchange requests

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 2–3 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in student should be able to see exchange requests they sent or received.

**Spec:** `apps/backend/docs/endpoints.md` §7, §9

#### Acceptance criteria

- [ ] `GET /api/v1/users/me/exchanges` supports `role`, `status`, `type` filters
- [ ] Supports pagination with `page` and `limit`
- [ ] Requires authentication
- [ ] Integration tests

---

### Issue B-16 — Student lookup

**Labels:** `backend`, `good first issue`, `T1`, `week-1`  
**Milestone:** Backend Phase 1  
**Estimate:** 3–4 days  
**Suggested owner:** Newcomer / frontend-crossover  
**Blocked by:** I-1

#### Description

A logged-in user should be able to look up another student’s public profile, photo, schedule, and course metadata.

**Spec:** `apps/backend/docs/endpoints.md` §7

#### Acceptance criteria

- [ ] `GET /api/v1/students/:nmec` returns public profile (name only)
- [ ] `GET /api/v1/students/:nmec/photo` returns photo URL
- [ ] `GET /api/v1/students/:nmec/schedule` is admin/participant-scoped
- [ ] `GET /api/v1/students/:nmec/courses/:courseId/metadata` is admin-scoped
- [ ] 403/404 handling
- [ ] Integration tests

---

## Backend Phase 2 — Exchanges & enrollment requests (week 2)

### Issue B-17 — Marketplace browse and exchange metadata

**Labels:** `backend`, `T1`, `week-2`  
**Milestone:** Backend Phase 2  
**Estimate:** 2–3 days  
**Suggested owner:** Junior backend-capable member  
**Blocked by:** B-4, B-15

#### Description

A logged-in user should be able to browse marketplace exchange offers and view the metadata needed for the exchange request card.

**Spec:** `apps/backend/docs/endpoints.md` §5, §9

#### Acceptance criteria

- [ ] `GET /api/v1/exchanges?type=MARKETPLACE` supports filters and pagination
- [ ] `GET /api/v1/occurrences/:id/exchange-metadata` returns request-card metadata
- [ ] Filters: `type`, `status`, `occurrence`, `courseUnitNameFilter`, `classesFilter`
- [ ] Requires authentication
- [ ] Integration tests

---

### Issue B-18 — Create marketplace or urgent exchange request

**Labels:** `backend`, `T2`, `week-2`  
**Milestone:** Backend Phase 2  
**Estimate:** 3–4 days  
**Suggested owner:** Backend dev #1  
**Blocked by:** B-17

#### Description

A logged-in student should be able to create a marketplace offer or an urgent exchange request.

**Spec:** `apps/backend/docs/endpoints.md` §9

#### Acceptance criteria

- [ ] `POST /api/v1/exchanges` creates a marketplace or urgent request
- [ ] Body validation for `type`, `message` (urgent), `items`
- [ ] Marketplace/urgent creates one `ExchangeItem`
- [ ] `GET /api/v1/exchanges/:id` returns the created request
- [ ] Integration tests

---

### Issue B-19 — Create direct exchange request

**Labels:** `backend`, `T2`, `week-2`  
**Milestone:** Backend Phase 2  
**Estimate:** 3–4 days  
**Suggested owner:** Backend dev #1  
**Blocked by:** B-18

#### Description

Two logged-in students should be able to propose a class swap through a direct exchange request.

**Spec:** `apps/backend/docs/endpoints.md` §9

#### Acceptance criteria

- [ ] `POST /api/v1/exchanges` with `type: DIRECT` creates a direct exchange
- [ ] Two `ExchangeItem` rows created (one per student)
- [ ] `fromClassId` / `toClassId` validated against occurrence
- [ ] Basic overlap check
- [ ] Integration tests

---

### Issue B-20 — Manage exchange request lifecycle

**Labels:** `backend`, `T2`, `week-2`  
**Milestone:** Backend Phase 2  
**Estimate:** 3–4 days  
**Suggested owner:** Backend dev #2  
**Blocked by:** B-18

#### Description

A logged-in student should be able to cancel their exchange request, accept a direct exchange, or claim a marketplace offer.

**Spec:** `apps/backend/docs/endpoints.md` §9

#### Acceptance criteria

- [ ] `DELETE /api/v1/exchanges/:id` sets status to `CANCELLED`
- [ ] `POST /api/v1/exchanges/:id/accept` updates acceptance state
- [ ] `POST /api/v1/exchanges/:id/claim` sets `targetUserId` and status to `PENDING`
- [ ] Ownership/permission checks enforced
- [ ] Integration tests

---

### Issue B-21 — Update and revalidate exchange

**Labels:** `backend`, `T2`, `week-2`  
**Milestone:** Backend Phase 2  
**Estimate:** 2–3 days  
**Suggested owner:** Backend dev #2  
**Blocked by:** B-18

#### Description

The creator of an urgent request should be able to update its message, and any user should be able to revalidate a request against current enrollments.

**Spec:** `apps/backend/docs/endpoints.md` §9

#### Acceptance criteria

- [ ] `PUT /api/v1/exchanges/:id/message` restricted to urgent request creator
- [ ] `POST /api/v1/exchanges/:id/revalidate` checks enrollments and cancels if invalid
- [ ] Integration tests

---

### Issue B-22 — Related exchanges and email token verification

**Labels:** `backend`, `T2`, `week-2`  
**Milestone:** Backend Phase 2  
**Estimate:** 3–4 days  
**Suggested owner:** Backend dev #1  
**Blocked by:** B-18

#### Description

A user should be able to see related or conflicting exchange offers, and confirm participation via an email token.

**Spec:** `apps/backend/docs/endpoints.md` §9

#### Acceptance criteria

- [ ] `GET /api/v1/exchanges/:id/related` returns related/conflicting offers
- [ ] `POST /api/v1/exchanges/verify/:token` confirms participation from email link
- [ ] Integration tests

---

### Issue B-23 — Enrollment requests

**Labels:** `backend`, `T2`, `week-2`  
**Milestone:** Backend Phase 2  
**Estimate:** 3–4 days  
**Suggested owner:** Junior backend-capable member  
**Blocked by:** B-12

#### Description

A logged-in student should be able to submit enrollment/drop requests for occurrences and withdraw them.

**Spec:** `apps/backend/docs/endpoints.md` §11

#### Acceptance criteria

- [ ] `GET /api/v1/enrollment-requests` lists my requests
- [ ] `POST /api/v1/enrollment-requests` submits options array
- [ ] `GET /api/v1/enrollment-requests/:id` returns request detail
- [ ] `DELETE /api/v1/enrollment-requests/:id` withdraws request
- [ ] Integration tests

---

## Backend Phase 3 — Admin & compatibility (week 3)

### Issue B-24 — Admin scoped resources

**Labels:** `backend`, `T2`, `week-3`  
**Milestone:** Backend Phase 3  
**Estimate:** 2–3 days  
**Suggested owner:** Backend dev #2  
**Blocked by:** B-2, B-4

#### Description

An admin should be able to see which courses and occurrences they are authorized to manage.

**Spec:** `apps/backend/docs/endpoints.md` §12

#### Acceptance criteria

- [ ] `GET /api/v1/admin/courses` lists courses the admin manages
- [ ] `GET /api/v1/admin/occurrences` lists occurrences the admin manages
- [ ] Requires `isAdmin`
- [ ] Integration tests

---

### Issue B-25 — Admin manage exchange periods

**Labels:** `backend`, `T2`, `T3`, `week-3`  
**Milestone:** Backend Phase 3  
**Estimate:** 3–4 days  
**Suggested owner:** Backend dev #1  
**Blocked by:** B-8, B-24

#### Description

An admin should be able to open, edit, and delete exchange windows for occurrences and courses.

**Spec:** `apps/backend/docs/endpoints.md` §3, §5

#### Acceptance criteria

- [ ] `POST /api/v1/occurrences/:id/periods` creates a period
- [ ] `PUT /api/v1/occurrences/:id/periods/:periodId` edits a period
- [ ] `DELETE /api/v1/occurrences/:id/periods/:periodId` deletes a period
- [ ] `POST /api/v1/courses/:id/periods` opens periods for all occurrences in a transaction with overlap check
- [ ] Integration tests

---

### Issue B-26 — Admin manage exchange requests

**Labels:** `backend`, `T3`, `week-3`  
**Milestone:** Backend Phase 3  
**Estimate:** 4–6 days  
**Suggested owner:** Backend dev #2  
**Blocked by:** B-18, B-24

#### Description

An admin should be able to list, approve, reject, mark awaiting-info, and assign urgent exchange requests.

**Spec:** `apps/backend/docs/endpoints.md` §10

#### Acceptance criteria

- [ ] `GET /api/v1/admin/exchanges` lists requests with admin filters
- [ ] `GET /api/v1/admin/exchanges/statistics` returns dashboard stats
- [ ] `GET /api/v1/admin/marketplace` returns admin marketplace view
- [ ] `POST /api/v1/admin/exchanges/:id/accept` approves a request
- [ ] `POST /api/v1/admin/exchanges/:id/reject` rejects a request
- [ ] `POST /api/v1/admin/exchanges/:id/awaiting-information` marks awaiting info
- [ ] `POST /api/v1/admin/exchanges/:id/assign` assigns urgent request to student
- [ ] Integration tests

---

### Issue B-27 — Admin manage enrollment requests

**Labels:** `backend`, `T3`, `week-3`  
**Milestone:** Backend Phase 3  
**Estimate:** 3–4 days  
**Suggested owner:** Backend dev #1  
**Blocked by:** B-23, B-24

#### Description

An admin should be able to list and decide enrollment requests.

**Spec:** `apps/backend/docs/endpoints.md` §11

#### Acceptance criteria

- [ ] `GET /api/v1/admin/enrollment-requests` lists requests with filters and pagination
- [ ] `POST /api/v1/admin/enrollment-requests/:id/accept` approves and updates enrollments
- [ ] `POST /api/v1/admin/enrollment-requests/:id/reject` rejects request
- [ ] Integration tests

---

### Issue B-28 — Auth compatibility shims

**Labels:** `backend`, `T2`, `week-3`  
**Milestone:** Backend Phase 3  
**Estimate:** 2–3 days  
**Suggested owner:** Backend dev #2  
**Blocked by:** B-9

#### Description

Provide temporary compatibility routes so the un-migrated frontend can still log in and out while the cutover is in progress.

**Spec:** `apps/backend/docs/endpoints.md` §14

#### Acceptance criteria

- [ ] `GET /api/v1/oidc-auth/authenticate/` redirects or aliases to `/api/v1/auth/login`
- [ ] `POST /api/v1/oidc-auth/logout/` aliases to `/api/v1/auth/logout`
- [ ] `POST /api/v1/auth/dev-login` replaces `/sigarra_login/`, guarded by env flag
- [ ] Integration tests

---

## Frontend migration issues

### Issue F-1 — Migrate auth flow to new backend

**Labels:** `frontend`, `T1`, `week-2`  
**Milestone:** Frontend Migration  
**Estimate:** 2–3 days  
**Suggested owner:** Frontend dev  
**Blocked by:** B-9, B-28, I-2

#### Description

Update the frontend authentication flow to use the new Elysia backend endpoints and remove legacy CSRF handling.

**Files to update:**

- `src/App.tsx` — remove `GET /csrf/` call
- `src/api/services/authService.ts` — update logout URL, remove `X-CSRFToken`
- `src/components/auth/LoginButton.tsx` — update OIDC login URL
- `src/hooks/useSession.tsx` — use `/api/v1/auth/me`

#### Acceptance criteria

- [ ] User can log in via new backend
- [ ] User can log out via new backend
- [ ] No CSRF token usage remains in auth code
- [ ] Session state works after refresh
- [ ] Manual test checklist completed

---

### Issue F-2 — Migrate course catalog API calls

**Labels:** `frontend`, `T1`, `week-2`  
**Milestone:** Frontend Migration  
**Estimate:** 3–4 days  
**Suggested owner:** Frontend-crossover / frontend dev  
**Blocked by:** B-1, B-2, B-3, B-4, B-5, B-6, B-7, I-2

#### Description

Update the frontend catalog calls to use the new resource-oriented API.

**Files to update:**

- `src/api/backend.ts`
  - `getMajors()` → `GET /api/v1/courses?year=`
  - `getCoursesByMajorId()` → `GET /api/v1/courses/:id/occurrences?year=&semester=`
  - `getCourseClass()` → `GET /api/v1/occurrences/:id/classes`
  - `getCourseUnit()` → `GET /api/v1/occurrences/:id`
  - `getCourseUnitHashes()` → `GET /api/v1/occurrences/hashes`
- `src/hooks/useCourseUnits.tsx`
- `src/hooks/useCourseUnitClasses.tsx`
- `src/hooks/useVerifyCourseUnitHashes.tsx`

#### Acceptance criteria

- [ ] Major/course selection works
- [ ] Class schedules load
- [ ] Hash verification works
- [ ] No legacy `/course/`, `/course_units/`, `/class/`, `/course_unit/` calls remain
- [ ] Manual test checklist completed

---

### Issue F-3 — Migrate student schedule

**Labels:** `frontend`, `T1`, `week-2`  
**Milestone:** Frontend Migration  
**Estimate:** 2–3 days  
**Suggested owner:** Frontend-crossover / frontend dev  
**Blocked by:** B-10, B-11, B-16, I-2

#### Description

Update the schedule-related API calls to use the new backend endpoints.

**Files to update:**

- `src/hooks/useSchedule.tsx` → `GET /api/v1/users/me/schedule`
- `src/api/services/studentScheduleRequestService.ts` → `PUT /api/v1/users/me/schedule/refresh`
- `src/hooks/useStudentsSchedule.tsx` → `GET /api/v1/students/:nmec/schedule`

#### Acceptance criteria

- [ ] Schedule loads for current user
- [ ] Refresh schedule works
- [ ] Other student’s schedule loads where authorized
- [ ] Manual test checklist completed

---

### Issue F-4 — Migrate student course units and eligibility

**Labels:** `frontend`, `T1`, `week-2`  
**Milestone:** Frontend Migration  
**Estimate:** 1–2 days  
**Suggested owner:** Frontend-crossover / frontend dev  
**Blocked by:** B-12, B-13, I-2

#### Description

Update eligibility and course-unit API calls to use the new endpoint.

**Files to update:**

- `src/hooks/useStudentCourseUnits.tsx` → `GET /api/v1/users/me/eligible-occurrences`
- `src/hooks/useEligibleExchange.tsx` — fix or remove duplicate `/student/exchange/eligible` call

#### Acceptance criteria

- [ ] Eligible occurrences load correctly
- [ ] No dead `/student/course_units/eligible` or `/student/exchange/eligible` calls remain
- [ ] Manual test checklist completed

---

### Issue F-5 — Migrate exchange requests list

**Labels:** `frontend`, `T1`, `week-2`  
**Milestone:** Frontend Migration  
**Estimate:** 2–3 days  
**Suggested owner:** Frontend-crossover / frontend dev  
**Blocked by:** B-15, I-2

#### Description

Update sent and received exchange request lists to use the unified exchanges endpoint.

**Files to update:**

- `src/hooks/useSentRequests.tsx` → `GET /api/v1/users/me/exchanges?role=sent`
- `src/hooks/useReceivedRequests.tsx` → `GET /api/v1/users/me/exchanges?role=received`

#### Acceptance criteria

- [ ] Sent requests load
- [ ] Received requests load
- [ ] Pagination works
- [ ] Manual test checklist completed

---

### Issue F-6 — Migrate marketplace browse and request card metadata

**Labels:** `frontend`, `T1`, `week-2`  
**Milestone:** Frontend Migration  
**Estimate:** 2–3 days  
**Suggested owner:** Frontend dev  
**Blocked by:** B-17, I-2

#### Description

Update marketplace listing and exchange request card metadata to use the new endpoints.

**Files to update:**

- `src/hooks/useMarketplaceRequests.tsx` → `GET /api/v1/exchanges?type=MARKETPLACE`
- `src/hooks/useRequestCardCourseMetadata.tsx` → `GET /api/v1/occurrences/:id/exchange-metadata`
- `src/api/services/exchangeRequestService.ts` — `retrieveMarketplaceRequest`, `retrieveRequestCardMetadata`

#### Acceptance criteria

- [ ] Marketplace listing loads with filters
- [ ] Request card metadata loads
- [ ] Manual test checklist completed

---

### Issue F-7 — Migrate exchange create / accept / cancel / message

**Labels:** `frontend`, `T2`, `week-3`  
**Milestone:** Frontend Migration  
**Estimate:** 3–4 days  
**Suggested owner:** Frontend dev  
**Blocked by:** B-18, B-19, B-20, B-21, I-2

#### Description

Update exchange creation, acceptance, cancellation, and urgent message editing to use the new unified exchange resource.

**Files to update:**

- `src/api/services/exchangeRequestService.ts`
  - `submitExchangeRequest()` → `POST /api/v1/exchanges`
  - `acceptDirectExchangeRequest()` → `POST /api/v1/exchanges/:id/accept`
  - `cancelMarketplaceRequest()` → `DELETE /api/v1/exchanges/:id`
- `src/hooks/useAcceptDirectExchange.tsx`
- `src/hooks/exchange/useCancelMarketplaceExchange.tsx`
- `src/components/exchange/requests/view/cards/MineRequestCard.tsx` → `PUT /api/v1/exchanges/:id/message`

#### Acceptance criteria

- [ ] Direct exchange can be created
- [ ] Marketplace/urgent exchange can be created
- [ ] Accept, cancel, and message update work
- [ ] Manual test checklist completed

---

### Issue F-8 — Migrate exchange verify / related / revalidate

**Labels:** `frontend`, `T2`, `week-3`  
**Milestone:** Frontend Migration  
**Estimate:** 2–3 days  
**Suggested owner:** Frontend dev  
**Blocked by:** B-21, B-22, I-2

#### Description

Update email verification, related offers, and revalidation flows to use the new endpoints.

**Files to update:**

- `src/api/services/exchangeRequestService.ts`
  - `verifyExchangeRequest()` → `POST /api/v1/exchanges/verify/:token`
  - `getRelatedExchanges()` → `GET /api/v1/exchanges/:id/related`
  - `revalidateExchangeRequest()` → `POST /api/v1/exchanges/:id/revalidate`
- `src/hooks/useExchangeVerify.tsx`
- `src/hooks/exchange/useRelatedExchanges.tsx`
- `src/hooks/useDirectExchangeValidation.tsx`
- `src/components/exchange/verify/ExchangeVerifyStatus.tsx`

#### Acceptance criteria

- [ ] Email verification link works
- [ ] Related exchanges load
- [ ] Revalidation works
- [ ] Manual test checklist completed

---

### Issue F-9 — Migrate enrollment requests

**Labels:** `frontend`, `T2`, `week-3`  
**Milestone:** Frontend Migration  
**Estimate:** 2–3 days  
**Suggested owner:** Frontend dev  
**Blocked by:** B-23, I-2

#### Description

Update enrollment request submission to use the new endpoint and payload shape.

**Files to update:**

- `src/api/services/courseUnitEnrollmentService.ts`
  - `submitEnrollmentRequest()` → `POST /api/v1/enrollment-requests`
  - Update payload from `enrollCourses[]` to `{ options: [...] }`

#### Acceptance criteria

- [ ] Enrollment/drop request submits successfully
- [ ] Withdrawal works if UI supports it
- [ ] Manual test checklist completed

---

### Issue F-10 — Migrate admin panel

**Labels:** `frontend`, `T2`, `T3`, `week-3`  
**Milestone:** Frontend Migration  
**Estimate:** 4–6 days  
**Suggested owner:** Frontend dev  
**Blocked by:** B-24, B-25, B-26, B-27, I-2

#### Description

Update the admin panel to use the new admin endpoints and request payload shapes.

**Files to update:**

- `src/pages/Admin.tsx`
- `src/api/services/exchangeRequestService.ts` — admin reject/accept/awaiting-information, period CRUD
- All admin hooks and components (`useAdminExchange*`, `AdminExchangeCourseSettings`, etc.)

#### Acceptance criteria

- [ ] Admin can list and filter exchanges
- [ ] Admin can approve/reject/mark awaiting info
- [ ] Admin can open/edit/delete exchange periods
- [ ] Admin can manage enrollment requests
- [ ] Statistics dashboard loads
- [ ] Manual test checklist completed

---

### Issue F-11 — Migrate student info / photo

**Labels:** `frontend`, `T1`, `week-2`  
**Milestone:** Frontend Migration  
**Estimate:** 1–2 days  
**Suggested owner:** Frontend-crossover / frontend dev  
**Blocked by:** B-16, I-2

#### Description

Update student photo lookup to use the new endpoint.

**Files to update:**

- `src/api/services/studentInfo.ts` → `GET /api/v1/students/:nmec/photo`
- Components using student photos (`CommonCardHeader`, etc.)

#### Acceptance criteria

- [ ] Student photos load from new backend
- [ ] Mock avatar fallback still works in dev
- [ ] Manual test checklist completed

---

### Issue F-12 — Frontend cleanup and legacy code removal

**Labels:** `frontend`, `T1`, `cutover`  
**Milestone:** Frontend Migration  
**Estimate:** 2–3 days  
**Suggested owner:** Frontend dev  
**Blocked by:** F-1, F-2, F-3, F-4, F-5, F-6, F-7, F-8, F-9, F-10, F-11

#### Description

Remove all legacy backend integration code once the frontend has been fully migrated.

#### Acceptance criteria

- [ ] Remove `getInfo()` and `/info/` usage
- [ ] Remove CSRF helpers from `src/api/backend.ts`
- [ ] Remove legacy OIDC login/logout URL constants if unused
- [ ] Remove or deprecate `src/api/socket.ts` (collaboration deferred)
- [ ] Delete unused legacy endpoint strings
- [ ] Update frontend wiki/docs for API layer

---

## Integration & cutover issues

### Issue I-4 — End-to-end smoke tests

**Labels:** `infra`, `cutover`  
**Milestone:** Cutover  
**Estimate:** 3–4 days  
**Suggested owner:** QA / backend dev / frontend dev  
**Blocked by:** B-1 through B-28, F-1 through F-12

#### Description

Write and run end-to-end smoke tests covering the main user journeys on the new backend.

#### Acceptance criteria

- [ ] Smoke test: login → browse courses → view schedule → create exchange → logout
- [ ] Smoke test: admin login → open period → approve exchange → view statistics
- [ ] Smoke test: enrollment request submit → admin approve
- [ ] All critical failures documented
- [ ] Regression list created

---

### Issue I-5 — Production cutover

**Labels:** `infra`, `cutover`  
**Milestone:** Cutover  
**Estimate:** 2–3 days  
**Suggested owner:** Backend devs + DevOps  
**Blocked by:** I-4

#### Description

Switch production traffic to the new Elysia backend and decommission the legacy Django backend.

#### Acceptance criteria

- [ ] Production frontend points to new backend
- [ ] Reverse proxy / DNS routes traffic to new backend
- [ ] Sentry monitoring active
- [ ] Legacy backend on standby for rollback
- [ ] Compatibility shims removed after stability confirmed
- [ ] Rollback plan documented

---

## Summary table

| #    | Issue                  | Type  | Tier  | Milestone          | Estimate | Blocked by            |
| ---- | ---------------------- | ----- | ----- | ------------------ | -------- | --------------------- |
| I-1  | Backend foundation     | INFRA | T2    | Foundation         | 4–6d     | —                     |
| I-2  | Frontend env config    | INFRA | T1    | Foundation         | 1–2d     | I-1                   |
| I-3  | Data migration         | INFRA | T3    | Foundation         | 5–8d     | I-1                   |
| B-1  | Browse faculties       | BE    | T1    | Backend Phase 1    | 1–2d     | I-1                   |
| B-2  | Browse courses         | BE    | T1    | Backend Phase 1    | 2–3d     | I-1                   |
| B-3  | View course units      | BE    | T1    | Backend Phase 1    | 2–3d     | I-1                   |
| B-4  | View occurrences       | BE    | T1    | Backend Phase 1    | 2–3d     | I-1                   |
| B-5  | View classes           | BE    | T1    | Backend Phase 1    | 2–3d     | I-1                   |
| B-6  | View slots             | BE    | T1    | Backend Phase 1    | 2–3d     | I-1                   |
| B-7  | Verify hashes          | BE    | T1    | Backend Phase 1    | 1–2d     | I-1                   |
| B-8  | View exchange periods  | BE    | T1    | Backend Phase 1    | 2–3d     | I-1                   |
| B-9  | Current user profile   | BE    | T1    | Backend Phase 1    | 1–2d     | I-1                   |
| B-10 | My schedule            | BE    | T1    | Backend Phase 1    | 2–3d     | I-1                   |
| B-11 | Refresh schedule       | BE    | T2    | Backend Phase 1    | 3–4d     | I-1                   |
| B-12 | My enrollments         | BE    | T1    | Backend Phase 1    | 2–3d     | I-1                   |
| B-13 | Eligible occurrences   | BE    | T1    | Backend Phase 1    | 2–3d     | I-1                   |
| B-14 | Planner state          | BE    | T1/T2 | Backend Phase 1    | 3–4d     | I-1                   |
| B-15 | My exchange requests   | BE    | T1    | Backend Phase 1    | 2–3d     | I-1                   |
| B-16 | Student lookup         | BE    | T1    | Backend Phase 1    | 3–4d     | I-1                   |
| B-17 | Marketplace + metadata | BE    | T1    | Backend Phase 2    | 2–3d     | B-4, B-15             |
| B-18 | Create exchange        | BE    | T2    | Backend Phase 2    | 3–4d     | B-17                  |
| B-19 | Direct exchange        | BE    | T2    | Backend Phase 2    | 3–4d     | B-18                  |
| B-20 | Exchange lifecycle     | BE    | T2    | Backend Phase 2    | 3–4d     | B-18                  |
| B-21 | Revalidate/message     | BE    | T2    | Backend Phase 2    | 2–3d     | B-18                  |
| B-22 | Related/verify         | BE    | T2    | Backend Phase 2    | 3–4d     | B-18                  |
| B-23 | Enrollment requests    | BE    | T2    | Backend Phase 2    | 3–4d     | B-12                  |
| B-24 | Admin scope            | BE    | T2    | Backend Phase 3    | 2–3d     | B-2, B-4              |
| B-25 | Admin periods          | BE    | T2/T3 | Backend Phase 3    | 3–4d     | B-8, B-24             |
| B-26 | Admin exchanges        | BE    | T3    | Backend Phase 3    | 4–6d     | B-18, B-24            |
| B-27 | Admin enrollment       | BE    | T3    | Backend Phase 3    | 3–4d     | B-23, B-24            |
| B-28 | Auth shims             | BE    | T2    | Backend Phase 3    | 2–3d     | B-9                   |
| F-1  | Auth flow              | FE    | T1    | Frontend Migration | 2–3d     | B-9, B-28, I-2        |
| F-2  | Catalog                | FE    | T1    | Frontend Migration | 3–4d     | B-1–B-7, I-2          |
| F-3  | Schedule               | FE    | T1    | Frontend Migration | 2–3d     | B-10, B-11, B-16, I-2 |
| F-4  | Eligibility            | FE    | T1    | Frontend Migration | 1–2d     | B-12, B-13, I-2       |
| F-5  | Exchange list          | FE    | T1    | Frontend Migration | 2–3d     | B-15, I-2             |
| F-6  | Marketplace            | FE    | T1    | Frontend Migration | 2–3d     | B-17, I-2             |
| F-7  | Exchange actions       | FE    | T2    | Frontend Migration | 3–4d     | B-18–B-21, I-2        |
| F-8  | Verify/related         | FE    | T2    | Frontend Migration | 2–3d     | B-21, B-22, I-2       |
| F-9  | Enrollment             | FE    | T2    | Frontend Migration | 2–3d     | B-23, I-2             |
| F-10 | Admin panel            | FE    | T2/T3 | Frontend Migration | 4–6d     | B-24–B-27, I-2        |
| F-11 | Student info           | FE    | T1    | Frontend Migration | 1–2d     | B-16, I-2             |
| F-12 | Cleanup                | FE    | T1    | Frontend Migration | 2–3d     | F-1–F-11              |
| I-4  | Smoke tests            | INFRA | —     | Cutover            | 3–4d     | All BE + FE           |
| I-5  | Cutover                | INFRA | —     | Cutover            | 2–3d     | I-4                   |

---

## Dependency summary

Dependencies are listed in each issue's **Blocked by** field and in the summary table above. The high-level order is:

### Foundation

- **I-1 Backend foundation** blocks everything (all backend and frontend issues).
- **I-2 Frontend env config** blocks all frontend migration issues (F-1 to F-12).
- **I-3 Data migration** blocks B-11, B-15, B-18, B-23, B-26, B-27.

### Backend Phase 1 (week 1 — all parallel)

- B-1 to B-16 depend only on I-1 and can be worked on in parallel.

### Backend Phase 2 (week 2)

- B-17 Marketplace + metadata depends on B-4 (occurrences) and B-15 (my exchanges).
- B-18 Create exchange depends on B-17.
- B-19 Direct exchange depends on B-18.
- B-20 Exchange lifecycle depends on B-18.
- B-21 Revalidate/message depends on B-18.
- B-22 Related/verify depends on B-18.
- B-23 Enrollment requests depends on B-12 (my enrollments).

### Backend Phase 3 (week 3)

- B-24 Admin scope depends on B-2 (courses) and B-4 (occurrences).
- B-25 Admin periods depends on B-8 (exchange periods read) and B-24.
- B-26 Admin exchanges depends on B-18 and B-24.
- B-27 Admin enrollment depends on B-23 and B-24.
- B-28 Auth shims depends on B-9 (current user).

### Frontend migrations

- **F-1 Auth** depends on B-9, B-28, and I-2.
- **F-2 Catalog** depends on B-1 to B-7 and I-2.
- **F-3 Schedule** depends on B-10, B-11, B-16, and I-2.
- **F-4 Eligibility** depends on B-12, B-13, and I-2.
- **F-5 Exchange list** depends on B-15 and I-2.
- **F-6 Marketplace** depends on B-17 and I-2.
- **F-7 Exchange actions** depends on B-18, B-19, B-20, B-21, and I-2.
- **F-8 Verify/related** depends on B-21, B-22, and I-2.
- **F-9 Enrollment** depends on B-23 and I-2.
- **F-10 Admin panel** depends on B-24, B-25, B-26, B-27, and I-2.
- **F-11 Student info** depends on B-16 and I-2.
- **F-12 Cleanup** depends on F-1 to F-11 (all frontend migrations).

### Cutover

- **I-4 Smoke tests** depends on all backend and frontend issues (B-1 to B-28, F-1 to F-12).
- **I-5 Production cutover** depends on I-4.

---

## Assignment suggestions

| Role                               | Issues                                           |
| ---------------------------------- | ------------------------------------------------ |
| **Backend devs (2)**               | I-1, I-3, I-5, B-11, B-18–B-22, B-25–B-28        |
| **Newcomers / frontend-crossover** | B-1–B-16 (week 1), F-2, F-3, F-4, F-5, F-6, F-11 |
| **Frontend devs**                  | F-1, F-7, F-8, F-9, F-10, F-12                   |
| **QA / integration**               | I-4                                              |
| **DevOps**                         | I-2, I-5                                         |
