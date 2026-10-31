# TTS API Endpoints

**This document is the single source of truth for the TTS backend API.** It contains the complete endpoint inventory for the Elysia backend redo, with a description of what each endpoint does, its authentication requirements, and its request/response shapes where relevant.

All routes are served under `/v1` unless noted otherwise. The public URL also carries an `/api` prefix, which the deployment (Niployments) adds — it is **not** part of the route declarations in this codebase.

This document maps the legacy Django routes (`apps/backend/legacy/django/university/urls.py`) to the new resource-oriented API where applicable.

---

## Conventions

- `?` = authenticated user
- `admin` = `User.isAdmin` true, plus relevant `AdminCourse` / `AdminOccurrence` scope for mutations
- List endpoints support pagination:
  - `?page=` and `?page_size=` for admin list endpoints (legacy style)
  - `?page=` and `?limit=` for marketplace/sent/received endpoints
- Admin list endpoints also support filters:
  - `?activeCourse=<courseId>`
  - `?activeCurricularYear=<year>`
  - `?activeStates=untreated,treated,...` (comma-separated)
- Errors return `{ error: string, code: string }` — see [Errors and how to raise them](#errors-and-how-to-raise-them)
- `users/me` aliases to the session owner (NMEC = `User.id`)

### Errors and how to raise them

Every failing response is `{ error, code }`: `error` is written for the caller, `code` is a stable, kebab-case identifier the client branches on. Routes do not build error responses by hand — they throw, and `src/interface/middleware/error-handler.ts` converts the throw into the response (status, content type and logging included).

**Layering** — `HttpError`, `ErrorCode` and `genericErrorForStatus` live in `src/interface/errors/` because every one of them is transport: a wire shape, an HTTP status, or a status-to-body mapping. The directory is the enforcement, so a `domain/` or `application/` file importing from `interface/` is wrong on its face while one importing `core/` would not be. When the domain needs to fail it throws its own error from `domain/errors` — a `FacultyNotFound` that carries an acronym, not a status wearing a domain name — and the handler grows an `instanceof` branch for it next to the `HttpError` one. Nothing above moves when that happens, and the routes already importing `interface/errors` are unaffected.

**Failures — `throw httpError.<x>(...)`**

- `httpError.notFound`, `.badRequest`, `.unauthorized`, `.forbidden`, `.conflict`, `.internal`
- domain codes: `throw new HttpError('faculty-not-found', 'A faculty with acronym FEUP was not found', 404)`
- the status lives at the throw site, so it cannot disagree with the code

**`throw status(...)` — for anything that is not a failure of this contract**

- `status(204)` for an empty success
- a non-standard status, or one with its own body: `status(403, { error, code })`
- a bare `status(404)` does answer `404 not-found`, but it discards the route's message, so it is a poor way to report a missing faculty

**Automatic — the handler decides, the route throws nothing**

- a request that fails a route's `body`/`query`/`param`/`headers` schema, or a malformed JSON body → `422 validation-error`
- a route failing its own `response` schema → logged, then `500 internal-error`
- an unmatched route → `404 not-found`

**Rules that stop the two idioms drifting apart**

- `bad-request` (400) is for a route that read its input and decided it is wrong; `validation-error` (422) is for a request that never matched the declared schema. Reach for `httpError.badRequest` only in the first case — the second answers 422 whether or not the route noticed.
- Codes are the contract, messages are not. Never change a code the frontend already reads — add a new one; `apps/frontend/src/utils/error.ts` maps codes to user-facing copy.
- A 5xx is never described to the caller: it is logged server-side and answered with a fixed message, the code aside.
- A failure the route cannot fix (its own `response` schema, an unmapped status) is treated as a server bug: logged, and answered as a 500 rather than a 4xx.
- Declare the shape on the route — `response: { 404: apiError }` — so the Eden client types the error body on the frontend.

---

## Schema summary (as it affects the API)

- **`Faculty` ↔ `Course`** is many-to-many via `FacultyCourse`.
- **`CourseUnit`** is abstract/year-agnostic (e.g. *“BD”*). It does **not** own classes, periods, or enrollments.
- **`Occurrence`** is the concrete per-course, per-year instance (e.g. *“BD in LEIC, 2025/26”*). It owns `Class`, `ExchangePeriod`, `ExchangeItem`, `EnrollmentRequestOption`, `AdminOccurrence`.
- `Occurrence` PK is `(id, year)` because Sigarra reuses the same occurrence id across academic years.
- **`PlannerState`** stores the user’s planner choices and timetable drafts per academic year.

---

## 1. Auth

Sigarra federated authentication (OIDC-style redirect flow) in production, plus a
dev-only username/password login (see `POST /auth/dev-login` below).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/auth/login` | public | Redirect to Sigarra federated login |
| `GET` | `/auth/callback` | public | Sigarra redirects back here after login |
| `POST` | `/auth/logout` | `?` | Clear local session cookie |
| `GET` | `/auth/me` | `?` | Current user profile |
| `POST` | `/auth/dev-login` | public | Dev-only username/password login (env-gated) |

`POST /auth/dev-login` is enabled by `DEV_LOGIN_ENABLED` (default on, forced off
when `NODE_ENV=production`). With no body it uses the configured
`SIGARRA_USERNAME` / `SIGARRA_PASSWORD`; a `{ username, password }` body overrides
them. It validates against Sigarra and sets the same session cookie as OIDC.

### Compatibility-only auth routes

Kept for older clients; the current frontend uses the canonical routes above, so
these can be dropped once nothing references them.

They are mounted at the **root**, not under `/v1`, because clients built their
URLs from `BACKEND_URL` with an empty path prefix.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/oidc-auth/authenticate/` | public | 302 → `/v1/auth/login` |
| `POST` | `/oidc-auth/logout/` | `?` | Clears the session (ignores the legacy CSRF header) |
| `GET` | `/auth/info/` | public | Legacy `{ signed, username, name, eligible_exchange, is_admin }` shape |
| `POST` | `/sigarra_login/` | public | Dev-only local login bypass, gated by `DEV_LOGIN_ENABLED` |

### Flow

1. Frontend redirects to `GET /v1/auth/login?return_to=<frontend-url>`.
2. Backend redirects to Sigarra’s authorization endpoint with `/v1/auth/callback` as the callback.
3. Sigarra redirects to `GET /v1/auth/callback?code=...&state=...`.
4. Backend exchanges the code for tokens, fetches user info (NMEC, name, email), creates or updates the `User` row, creates a `Session`, sets an HTTP-only cookie, and redirects to `return_to`.

### `GET /auth/me` — response

```json
{
  "id": "202301234",
  "email": "up202301234@up.pt",
  "name": "Ana Silva",
  "signed": true,
  "isAdmin": false,
  "role": "USER"
}
```

`role` is `USER` | `ADMIN` | `SUPERUSER` and is assigned by the seeder, not by
logging in (see `db:seed:demo` / `ADMIN_ROLE`). Replaces legacy `GET /auth/info/`
and `GET /info/`.

---

## 2. Faculties

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/faculties` | `?` | List all faculties |
| `GET` | `/faculties/:acronym` | `?` | Single faculty |
| `GET` | `/faculties/:acronym/courses` | `?` | Courses offered by this faculty |

Legacy mapping: `GET /faculty/` → `GET /faculties`.

### `GET /faculties/:acronym/courses` — query params

- `year` — academic year, e.g. `2025`

### `GET /faculties/:acronym/courses` — response

```json
[
  {
    "id": 22841,
    "acronym": "L.EIC",
    "name": "Licenciatura em Engenharia Informática e Computação",
    "courseType": "L",
    "year": 2025,
    "url": "https://sigarra.up.pt/feup/pt/cur_geral.cur_view?pv_curso_id=22841",
    "faculties": ["FEUP"]
  }
]
```

Because a course can belong to multiple faculties, each course lists its faculty acronyms.

---

## 3. Courses

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/courses` | `?` | List courses |
| `GET` | `/courses/:id` | `?` | Single course |
| `GET` | `/courses/:id/units` | `?` | Abstract course units in this course |
| `GET` | `/courses/:id/occurrences` | `?` | Occurrences in this course |
| `GET` | `/courses/:id/periods` | `?` | Exchange periods for this course (derived from occurrences) |
| `POST` | `/courses/:id/periods` | admin | Open exchange window for every occurrence in the course |

### `GET /courses` — query params

- `year` — academic year
- `faculty` — faculty acronym

### `GET /courses/:id/units` — response

The abstract course units the course offers, ordered by acronym. An unknown course id answers `404 course-not-found`; a course that offers no units answers an empty list.

```json
[
  {
    "id": 42,
    "courseId": 22841,
    "acronym": "BD",
    "name": "Bases de Dados",
    "semester": 1
  }
]
```

### `GET /courses/:id/occurrences` — query params

- `year` — academic year
- `semester` — `1` or `2`

Legacy mapping:

- `GET /course/<int:year>` → `GET /courses?year=`
- `GET /course_units/<int:course_id>/<int:year>/<int:semester>/` → `GET /courses/:id/occurrences?year=&semester=`

### `POST /courses/:id/periods` — body

```json
{
  "startsAt": "2025-09-15T00:00:00Z",
  "endsAt": "2025-09-30T23:59:59Z"
}
```

Backend resolves all occurrences for the course, validates no overlap, and creates one `ExchangePeriod` per occurrence inside a transaction.

---

## 4. Course units

`CourseUnit` is the abstract template. For schedules, classes, periods, and exchange metadata, see §5 Occurrences.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/course-units/:id` | `?` | Single abstract course unit |
| `GET` | `/course-units/:id/occurrences` | `?` | Occurrences of this unit across courses/years |

### `GET /course-units/:id` — response

```json
{
  "id": 42,
  "courseId": 22841,
  "acronym": "BD",
  "name": "Bases de Dados",
  "semester": 1
}
```

An unknown id answers `404 course-unit-not-found`.

### `GET /course-units/:id/occurrences` — response

Every concrete occurrence of the unit, across the courses and academic years it is taught in, newest year first. An unknown id answers `404 course-unit-not-found`; a unit with no occurrences answers an empty list.

```json
[
  {
    "id": 587177,
    "courseUnitId": 42,
    "courseId": 22841,
    "year": 2025,
    "ects": 6,
    "url": "https://sigarra.up.pt/feup/pt/ucurr_geral.ficha_uc_view?pv_ocorrencia_id=587177",
    "hash": "abc..."
  }
]
```

`id` is the Sigarra occurrence id and is only unique per academic year — the row's real key is `(id, year)`.

---

## 5. Occurrences

Occurrence is the concrete instance that carries classes, schedule, periods, and admin scope.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/occurrences` | `?` | List occurrences |
| `GET` | `/occurrences/:id` | `?` | Single occurrence |
| `GET` | `/occurrences/:id/classes` | `?` | Classes for this occurrence |
| `GET` | `/occurrences/:id/slots` | `?` | Schedule slots for this occurrence |
| `GET` | `/occurrences/:id/periods` | `?` | Exchange periods for this occurrence |
| `POST` | `/occurrences/:id/periods` | admin | Create exchange period for this occurrence |
| `PUT` | `/occurrences/:id/periods/:periodId` | admin | Update period |
| `DELETE` | `/occurrences/:id/periods/:periodId` | admin | Delete period |
| `GET` | `/occurrences/:id/exchange-metadata` | `?` | Metadata for the exchange request card |
| `GET` | `/occurrences/hashes` | `?` | Hashes for a list of occurrence IDs |

### `GET /occurrences` — query params

- `course` — course id
- `year` — academic year
- `semester` — `1` or `2`
- `courseUnit` — course unit id

### `GET /occurrences/:id/classes` — response shape

Matches the frontend’s `CourseInfo` with embedded `ClassInfo`. The `id` here is the occurrence id, and `year` is the academic year.

```json
{
  "id": 123,
  "courseUnitId": 42,
  "courseId": 22841,
  "year": 2025,
  "semester": 1,
  "acronym": "BD",
  "name": "Bases de Dados",
  "ects": 6,
  "hash": "abc...",
  "classes": [
    {
      "id": 456,
      "name": "1LEIC01",
      "vacancies": 25,
      "filteredTeachers": [1, 2],
      "slots": [
        {
          "id": 789,
          "lesson_type": "T",
          "day": 1,
          "start_time": 9.5,
          "duration": 1.5,
          "location": "B001",
          "professors": [{ "id": 1, "acronym": "JAS", "name": "João Silva" }]
        }
      ]
    }
  ]
}
```

Legacy mapping:

- `GET /class/<int:course_unit_id>/` → `GET /occurrences/:id/classes`
- `GET /course_unit/<int:course_unit_id>/` → `GET /occurrences/:id` (or `GET /course-units/:id` for the abstract template)
- `GET /course_unit/<int:course_unit_id>/exchange/metadata` → `GET /occurrences/:id/exchange-metadata`
- `GET /course_unit/hash?ids=...` → `GET /occurrences/hashes?ids=...`

---

## 6. Classes and schedule slots

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/classes/:id` | `?` | Class detail with slots |
| `GET` | `/classes/:id/students` | admin | Students enrolled in this class |
| `GET` | `/slots/:id` | `?` | Schedule slot detail |
| `GET` | `/slots/:id/professors` | `?` | Professors assigned to this slot |

---

## 7. Users / students

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/users/me` | `?` | Current user (same as `/auth/me`) |
| `GET` | `/users/me/schedule` | `?` | My current schedule |
| `PUT` | `/users/me/schedule/refresh` | `?` | Resync my schedule and enrollments from Sigarra |
| `GET` | `/users/me/enrollments` | `?` | My class enrollments |
| `GET` | `/users/me/exchanges` | `?` | My exchange requests |
| `GET` | `/users/me/eligible-occurrences` | `?` | Occurrences I am eligible to take / exchange |
| `GET` | `/students/:nmec` | admin | Public student profile (name only) |
| `GET` | `/students/:nmec/schedule` | admin / participant | Another student’s schedule |
| `GET` | `/students/:nmec/photo` | `?` | Student photo URL |
| `GET` | `/students/:nmec/courses/:courseId/metadata` | admin | `fest_id` metadata for a student in a course |

### `GET /users/me/enrollments` — response

Returns an array containing one item per class enrollment. Each item includes
the occurrence year and course-unit details (including semester), plus the
class, schedule slots, and each slot's professors. A missing or invalid session
returns `401 unauthorized`.

```json
[
  {
    "occurrence": {
      "id": 12345,
      "year": 2025,
      "courseUnit": {
        "id": 42,
        "acronym": "BD",
        "name": "Bases de Dados",
        "semester": 1
      }
    },
    "class": {
      "id": 678,
      "name": "1LEIC01",
      "vacancies": 25,
      "slots": [
        {
          "id": 901,
          "lessonType": "TP",
          "dayOfWeek": 2,
          "startMinute": 540,
          "durationMin": 120,
          "location": "B108",
          "professors": [{ "id": 123, "acronym": "AS", "name": "Ana Silva" }]
        }
      ]
    }
  }
]
```

### `GET /users/me/schedule` — response

Returns the authenticated student's class schedule, derived from their
enrollments: one item per enrolled class, with the occurrence year, the
course-unit details and the class's schedule slots (each with its professors).
A missing or invalid session returns `401 unauthorized`.

Ordering: items follow the order of the student's enrollments (by class id).
Within each item, `slots` are sorted by `dayOfWeek` and then `startMinute`, so
the client can render them without sorting. `dayOfWeek` is `0` for Sunday;
`startMinute` is minutes since midnight (`540` = 09:00).

```json
[
  {
    "classId": 678,
    "className": "1LEIC01",
    "occurrence": {
      "id": 12345,
      "year": 2025,
      "courseUnit": {
        "id": 42,
        "acronym": "BD",
        "name": "Bases de Dados",
        "semester": 1
      }
    },
    "slots": [
      {
        "id": 901,
        "lessonType": "TP",
        "dayOfWeek": 2,
        "startMinute": 540,
        "durationMin": 120,
        "location": "B108",
        "professors": [{ "id": 123, "acronym": "AS", "name": "Ana Silva" }]
      }
    ]
  }
]
```

### `GET /users/me/exchanges` — query params

- `role` — `sent` | `received` | `all` (default `all`)
- `status` — `PENDING` | `ACCEPTED` | `CANCELLED`
- `type` — `DIRECT` | `MARKETPLACE` | `URGENT`

Legacy mapping:

- `GET /student/schedule` → `GET /users/me/schedule`
- `PUT /student/schedule` → `PUT /users/me/schedule/refresh`
- `GET /student/exchange/sent/` → `GET /users/me/exchanges?role=sent`
- `GET /student/exchange/received/` → `GET /users/me/exchanges?role=received`
- `GET /student/course_units/eligible` → `GET /users/me/eligible-occurrences`
- `GET /student/exchange/eligible` → `GET /users/me/exchange-eligible-occurrences`
- `GET /student/<str:nmec>/photo` → `GET /students/:nmec/photo`
- `GET /student/<str:nmec>/<int:course_id>/metadata` → `GET /students/:nmec/courses/:courseId/metadata`

---

## 8. Planner state

Cross-device persistence for the planner. Per-device settings stay in `localStorage`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/users/me/planner-state` | `?` | Get my planner state for the current/default year |
| `GET` | `/users/me/planner-state/:year` | `?` | Get planner state for a specific academic year |
| `PUT` | `/users/me/planner-state/:year` | `?` | Save planner state |
| `DELETE` | `/users/me/planner-state/:year` | `?` | Clear planner state |

### `PUT /users/me/planner-state/:year` — body

```json
{
  "state": { /* frontend-owned shape */ },
  "schemaVersion": 1
}
```

The backend stores the blob as JSON and updates `updatedAt`. The frontend compares `updatedAt` with its local last-write timestamp to resolve conflicts.

---

## 9. Exchanges

Unified resource for direct, marketplace, and urgent exchanges. `type` is a discriminator on `ExchangeRequest`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/exchanges` | `?` | List exchange requests |
| `POST` | `/exchanges` | `?` | Create a new exchange request |
| `GET` | `/exchanges/:id` | `?` | Single exchange request |
| `DELETE` | `/exchanges/:id` | `?` | Cancel / withdraw the request |
| `PUT` | `/exchanges/:id/message` | `?` | Update the message of my URGENT request |
| `POST` | `/exchanges/:id/accept` | `?` | Accept my side of a direct exchange |
| `POST` | `/exchanges/:id/claim` | `?` | Claim a marketplace offer |
| `POST` | `/exchanges/:id/revalidate` | `?` | Revalidate request against current enrollments |
| `GET` | `/exchanges/:id/related` | `?` | Related conflicts or compatible offers |
| `POST` | `/exchanges/verify/:token` | public | Verify a request from an email link |

### `GET /exchanges` — query params

- `type` — `DIRECT` | `MARKETPLACE` | `URGENT`
- `status` — `PENDING` | `ACCEPTED` | `CANCELLED`
- `occurrence` — filter by occurrence id
- `mine` — `true` to include only requests I created or am targeted by
- `page` / `limit` — pagination for marketplace/sent/received views
- `courseUnitNameFilter` — comma-separated occurrence/course-unit name filter (marketplace)
- `classesFilter` — base64-encoded JSON map of class filters (marketplace)

### `POST /exchanges` — body

```json
{
  "type": "DIRECT",
  "message": "", // only for URGENT
  "items": [
    {
      "userId": "202301234",
      "occurrenceId": 123,
      "occurrenceYear": 2025,
      "fromClassId": 456,
      "toClassId": 457
    },
    {
      "userId": "202301235",
      "occurrenceId": 123,
      "occurrenceYear": 2025,
      "fromClassId": 457,
      "toClassId": 456
    }
  ]
}
```

For `MARKETPLACE`, `items` has one row (the issuer). For `URGENT`, `message` is required and `items` has one row.

### `PUT /exchanges/:id/message` — body

```json
{
  "message": "Updated justification for the urgent request"
}
```

Only the creator of an `URGENT` request may update the message.

### `POST /exchanges/:id/claim` — body

```json
{ "userId": "202301235" }
```

Sets `targetUserId` and moves the marketplace offer to `PENDING` / awaiting acceptance.

Legacy mapping:

- `GET /exchange/marketplace/` → `GET /exchanges?type=MARKETPLACE`
- `POST /exchange/marketplace/` → `POST /exchanges` with `type: MARKETPLACE`
- `POST /exchange/direct/` → `POST /exchanges` with `type: DIRECT`
- `POST /exchange/urgent/` → `POST /exchanges` with `type: URGENT`
- `GET /exchange/direct/<int:id>` → `GET /exchanges/:id`
- `PUT /exchange/direct/<int:id>` → `POST /exchanges/:id/accept`
- `PUT /exchange/<str:request_type>/<int:id>/cancel/` → `DELETE /exchanges/:id`
- `POST /exchange/related/` → `GET /exchanges/:id/related`
- `POST /exchange/verify/<str:token>` → `POST /exchanges/verify/:token`
- `POST /exchange/<int:exchange_id>/revalidate/` → `POST /exchanges/:id/revalidate`
- `GET /exchange/direct/validate/<int:id>` → `GET /exchanges/:id/revalidate` (or `POST`; see note)

---

## 10. Admin exchange operations

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/admin/exchanges` | admin | All exchange requests (admin scoped) |
| `GET` | `/admin/exchanges/statistics` | admin | Dashboard statistics |
| `POST` | `/admin/exchanges/:id/accept` | admin | Approve request |
| `POST` | `/admin/exchanges/:id/reject` | admin | Reject request |
| `POST` | `/admin/exchanges/:id/awaiting-information` | admin | Mark as awaiting information |
| `POST` | `/admin/exchanges/:id/assign` | admin | Assign an URGENT request to a student |
| `GET` | `/admin/marketplace` | admin | Marketplace admin view |
### `GET /admin/exchanges` — query params

- `type` — `DIRECT` | `MARKETPLACE` | `URGENT`
- `status` — `PENDING` | `ACCEPTED` | `CANCELLED`
- `adminState` — `UNTREATED` | `TREATED` | `REJECTED` | `AWAITING_INFORMATION`
- `page` / `page_size`
- `activeCourse`, `activeCurricularYear`, `activeStates` — admin filters

Legacy mapping:

- `GET /exchange/direct/?page=&page_size=` → `GET /admin/exchanges?type=DIRECT&page=&page_size=`
- `GET /exchange/urgent/?page=&page_size=` → `GET /admin/exchanges?type=URGENT&page=&page_size=`
- `GET /exchange/admin/marketplace?page=&page_size=` → `GET /admin/exchanges?type=MARKETPLACE&page=&page_size=` (or keep `/admin/marketplace` as an alias)
- `GET /exchange/admin/statistics/` → `GET /admin/exchanges/statistics`
- `PUT /exchange/admin/request/<str:request_type>/<int:id>/accept/` → `POST /admin/exchanges/:id/accept`
- `PUT /exchange/admin/request/<str:request_type>/<int:id>/reject/` → `POST /admin/exchanges/:id/reject`
- `PUT /exchange/admin/request/<str:request_type>/<int:id>/awaiting-information/` → `POST /admin/exchanges/:id/awaiting-information`
- `GET /exchange/export/csv` → `GET /admin/exchanges/export.csv`

---

## 11. Enrollment requests

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/enrollment-requests` | `?` | My enrollment requests |
| `POST` | `/enrollment-requests` | `?` | Submit enrollment / drop request |
| `GET` | `/enrollment-requests/:id` | `?` | Request detail |
| `DELETE` | `/enrollment-requests/:id` | `?` | Withdraw request |
| `GET` | `/admin/enrollment-requests` | admin | Admin list |
| `POST` | `/admin/enrollment-requests/:id/accept` | admin | Approve |
| `POST` | `/admin/enrollment-requests/:id/reject` | admin | Reject |

### `GET /admin/enrollment-requests` — query params

- `page` / `page_size`
- `activeCourse`, `activeCurricularYear`, `activeStates` — admin filters

### `POST /enrollment-requests` — body

```json
{
  "options": [
    { "occurrenceId": 123, "occurrenceYear": 2025, "enrolling": true },
    { "occurrenceId": 124, "occurrenceYear": 2025, "enrolling": false }
  ]
}
```

Legacy mapping:

- `POST /course_unit/enrollment/` → `POST /enrollment-requests`
- `GET /course_unit/enrollment/?page=&page_size=` → `GET /admin/enrollment-requests?page=&page_size=`

---

## 12. Admin scoping helpers

Read-only endpoints for the admin panel to discover what the current user manages.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/admin/courses` | admin | Courses I can administer |
| `GET` | `/admin/occurrences` | admin | Occurrences I can administer |

Legacy mapping:

- `GET /exchange/admin/courses/` → `GET /admin/courses`
- `GET /exchange/admin/course_units/` → `GET /admin/occurrences`

---

## 13. WebSocket (collaborative planner sessions) — future reference

> **Not implemented in the first backend iteration.** The frontend still has Socket.IO code, but the legacy ASGI app never mounted the server, so the feature is currently unreachable. This section documents the events for a future implementation.

| Event | Direction | Purpose |
|---|---|---|
| `connect` | C → S | Connect with `participant_name` and optional `session_id` |
| `connected` | S → C | Server assigns `client_id`, `session_id`, `session_info` |
| custom state events | C ↔ S | Broadcast planner draft changes to session participants |

### `GET /socket.io/` (Socket.IO handshake)

- Auth: session cookie
- Query params: `session_id`, `participant_name`

Legacy mapping: the legacy backend had `university/socket/` routes; a future implementation would expose the standard Socket.IO path.

---

## 14. Compatibility-only / legacy endpoints

These are called by the current frontend but should be removed once the frontend is migrated.

| Legacy route | New route | Notes |
|---|---|---|
| `GET /csrf/` | — | Not needed with HTTP-only session cookies + CORS; drop after frontend cleanup |
| `GET /oidc-auth/authenticate/` | `GET /v1/auth/login` | Frontend login redirect |
| `POST /oidc-auth/logout/` | `POST /v1/auth/logout` | Frontend logout |
| `POST /sigarra_login/` | `POST /v1/auth/dev-login` | Dev-only; rename and guard behind env flag |

---

## 15. Full legacy-to-new route map

| Legacy route | New route | Notes |
|---|---|---|
| `GET /faculty/` | `GET /v1/faculties` | |
| `GET /course/<int:year>` | `GET /v1/courses?year=` | |
| `GET /course/<int:course_id>/groups` | — | Dropped: course groups removed |
| `GET /course_group/<int:course_group_id>/course_units` | — | Dropped: course groups removed |
| `GET /course_units/<int:course_id>/<int:year>/<int:semester>/` | `GET /v1/courses/:id/occurrences?year=&semester=` | |
| `GET /info/` | `GET /v1/auth/me` | |
| `GET /auth/info/` | `GET /v1/auth/me` | |
| `GET /csrf/` | — | Drop after frontend cleanup |
| `GET /student/schedule` | `GET /v1/users/me/schedule` | |
| `PUT /student/schedule` | `PUT /v1/users/me/schedule/refresh` | |
| `GET /student/exchange/sent/` | `GET /v1/users/me/exchanges?role=sent` | |
| `GET /student/exchange/received/` | `GET /v1/users/me/exchanges?role=received` | |
| `GET /student/<str:nmec>/<int:course_id>/metadata` | `GET /v1/students/:nmec/courses/:courseId/metadata` | |
| `GET /student/course_units/eligible` | `GET /v1/users/me/eligible-occurrences` | |
| `GET /student/exchange/eligible` | `GET /v1/users/me/eligible-occurrences` | ⚠️ Not a real legacy endpoint; frontend bug |
| `GET /student/<str:nmec>/photo` | `GET /v1/students/:nmec/photo` | |
| `GET /exchange/verify/<str:token>` | `POST /v1/exchanges/verify/:token` | |
| `GET /student_data/<str:codigo>/` | — | Absorbed into `/auth/callback` or Sigarra adapter |
| `GET /exchange/marketplace/` | `GET /v1/exchanges?type=MARKETPLACE` | |
| `POST /exchange/marketplace/` | `POST /v1/exchanges` | body `type: MARKETPLACE` |
| `POST /exchange/direct/` | `POST /v1/exchanges` | body `type: DIRECT` |
| `POST /exchange/urgent/` | `POST /v1/exchanges` | body `type: URGENT` |
| `GET /exchange/direct/<int:id>` | `GET /v1/exchanges/:id` | |
| `PUT /exchange/direct/<int:id>` | `POST /v1/exchanges/:id/accept` | |
| `GET /exchange/direct/validate/<int:id>` | `POST /v1/exchanges/:id/revalidate` | or `GET` |
| `GET /exchange/direct/?page=&page_size=` | `GET /v1/admin/exchanges?type=DIRECT&page=&page_size=` | |
| `GET /exchange/urgent/?page=&page_size=` | `GET /v1/admin/exchanges?type=URGENT&page=&page_size=` | |
| `PUT /exchange/<str:request_type>/<int:id>/cancel/` | `DELETE /v1/exchanges/:id` | |
| `PUT /exchange/urgent/` | `PUT /v1/exchanges/:id/message` | Update urgent request message |
| `GET /exchange/export/csv` | — | Dropped by decision |
| `POST /exchange/related/` | `GET /v1/exchanges/:id/related` | |
| `POST /exchange/<int:exchange_id>/revalidate/` | `POST /v1/exchanges/:id/revalidate` | |
| `GET /course_unit/<int:course_unit_id>/exchange/metadata` | `GET /v1/occurrences/:id/exchange-metadata` | |
| `GET /course_unit/<int:course_unit_id>/` | `GET /v1/occurrences/:id` | or `/course-units/:id` for the abstract template |
| `GET /class/<int:course_unit_id>/` | `GET /v1/occurrences/:id/classes` | |
| `GET /professors/<int:slot>/` | `GET /v1/slots/:id/professors` | |
| `GET /course_unit/hash` | `GET /v1/occurrences/hashes` | |
| `POST /course_unit/enrollment/` | `POST /v1/enrollment-requests` | |
| `GET /course_unit/enrollment/?page=&page_size=` | `GET /v1/admin/enrollment-requests?page=&page_size=` | |
| `GET /exchange/admin/courses/` | `GET /v1/admin/courses` | |
| `GET /exchange/admin/course_units/` | `GET /v1/admin/occurrences` | |
| `GET /exchange/admin/classes/` | — | Dropped by decision |
| `GET /exchange/admin/statistics/` | `GET /v1/admin/exchanges/statistics` | |
| `GET /exchange/admin/marketplace` | `GET /v1/admin/exchanges?type=MARKETPLACE` | or keep `/admin/marketplace` alias |
| `GET /exchange/admin/course_unit/periods/` | — | Dropped by decision |
| `GET /exchange/admin/courses/periods/` | — | Dropped by decision |
| `POST /exchange/admin/course_unit/<int:course_unit_id>/period/` | `POST /v1/occurrences/:id/periods` | |
| `POST /exchange/admin/course/<int:course_id>/period/` | `POST /v1/courses/:id/periods` | |
| `PUT /exchange/admin/course_unit/<int:course_unit_id>/period/<int:period_id>/` | `PUT /v1/occurrences/:id/periods/:periodId` | |
| `PUT /exchange/admin/course/<int:course_id>/period/<int:period_id>/` | `PUT /v1/courses/:id/periods/:periodId` | |
| `PUT /exchange/admin/request/<str:request_type>/<int:id>/reject/` | `POST /v1/admin/exchanges/:id/reject` | |
| `PUT /exchange/admin/request/<str:request_type>/<int:id>/accept/` | `POST /v1/admin/exchanges/:id/accept` | |
| `PUT /exchange/admin/request/<str:request_type>/<int:id>/awaiting-information/` | `POST /v1/admin/exchanges/:id/awaiting-information` | |
| `GET /oidc-auth/authenticate/` | `GET /v1/auth/login` | Frontend redirect |
| `POST /oidc-auth/logout/` | `POST /v1/auth/logout` | |
| `POST /sigarra_login/` | `POST /v1/auth/dev-login` | Dev-only |

---

## 16. Suggested implementation order

1. **Auth**: `GET /auth/login`, `GET /auth/callback`, `GET /auth/me`
2. **Catalog read-only**: `GET /faculties`, `GET /courses`, `GET /courses/:id/occurrences`, `GET /occurrences/:id/classes`, `GET /occurrences/hashes`
3. **Student state**: `GET /users/me/schedule`, `PUT /users/me/schedule/refresh`, `GET /users/me/enrollments`, `GET /users/me/eligible-occurrences`, `GET /users/me/exchange-eligible-occurrences`
4. **Planner state**: `GET /users/me/planner-state/:year`, `PUT /users/me/planner-state/:year`
5. **Exchanges**: `POST /exchanges`, `GET /exchanges/:id`, `DELETE /exchanges/:id`, `POST /exchanges/:id/accept`, `POST /exchanges/:id/claim`
6. **Admin**: `GET /admin/exchanges`, `POST /admin/exchanges/:id/accept|reject|awaiting-information`, `GET /admin/exchanges/statistics`
7. **Enrollment requests**: `POST /enrollment-requests`, `GET /admin/enrollment-requests`, admin accept/reject
8. **Period management**: `POST /occurrences/:id/periods`, `POST /courses/:id/periods`
9. **Compatibility shims**: `/oidc-auth/*`, `/sigarra_login/` (only if frontend is not migrated yet)
10. **Future**: Socket.IO collaboration, CSV export

---

## 17. Final implementation set

Based on the decisions made while reviewing this document:

| Decision | Outcome |
|---|---|
| Auth compatibility routes | **Keep** — `/oidc-auth/authenticate/`, `/oidc-auth/logout/`, `/sigarra_login/` (as `/auth/dev-login`) |
| Admin scoping helpers | **Keep minimal** — only `/admin/courses` and `/admin/occurrences` |
| CSV export | **Drop** — can be added later |
| `/students/:nmec` profile | **Keep** |
| Socket.IO collaboration | **Document for future, do not implement now** |

### Resulting endpoint count

| Category | Count |
|---|---|
| Core endpoints (auth, catalog, student state, planner, exchanges, enrollments, periods) | 69 |
| Auth compatibility routes | 3 |
| **Total to implement now** | **72** |
| Future / deferred | Socket.IO handshake + events, CSV export |

The compatibility routes should be removed once the frontend is fully migrated.

---

*Document for the TTS backend redo. Last updated: October 2026.*
