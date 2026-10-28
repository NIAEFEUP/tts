import { t, type TSchema } from 'elysia'

import type { UserRole } from '@/core/auth/user'

// Wire schemas shared by the canonical (`/api/v1/auth/*`) and compatibility
// auth routes. Elysia uses them to validate responses, generate the OpenAPI
// docs, and strip fields the client should not see. Keeping them here — rather
// than inline per route — lets both surfaces describe the session identically.
//
// Error bodies (`{ error, code }`) use the shared `apiError` schema from
// `@/interface/middleware/error-handler`; each route instance registers it as
// the named model `ApiError`, so the spec inlines the shape only once.

// One schema per `UserRole`, kept in step with the domain: `satisfies` makes a
// role missing from this record a compile error, so the wire schema cannot
// drift from `core/auth/user`.
const ROLE = {
  USER: t.Literal('USER'),
  ADMIN: t.Literal('ADMIN'),
  SUPERUSER: t.Literal('SUPERUSER'),
} satisfies Record<UserRole, TSchema>

/** The roles the seeder can assign (see `core/auth/user`). */
const role = t.Union([ROLE.USER, ROLE.ADMIN, ROLE.SUPERUSER])

/** A signed-in identity as `/auth/me` and `/auth/dev-login` expose it. */
export const sessionUser = t.Object({
  signed: t.Literal(true),
  id: t.String(),
  name: t.String(),
  // Sigarra does not always release an email, so the stored value can be null.
  email: t.Union([t.String(), t.Null()]),
  isAdmin: t.Boolean(),
  role,
})

/** The signed-out marker returned by `/auth/me` and `/auth/logout`. */
export const anonymous = t.Object({ signed: t.Literal(false) })

/** A raw identity record, as the legacy `/sigarra_login/` returns it. */
export const userProfile = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.Union([t.String(), t.Null()]),
  role,
})

/** `/auth/me` answers with a signed-in user or the anonymous marker. */
export const sessionInfo = t.Union([sessionUser, anonymous])

/** Legacy `/auth/info/` shape, kept in step with the un-migrated frontend. */
export const legacySessionInfo = t.Union([
  t.Object({
    signed: t.Literal(true),
    username: t.String(),
    name: t.String(),
    // Exchange eligibility is not implemented on the new backend yet, so this
    // is documented as a boolean even though it is currently always false.
    eligible_exchange: t.Boolean(),
    is_admin: t.Boolean(),
  }),
  anonymous,
])
