import { t, type TSchema } from 'elysia'

import type { UserRole } from '@/core/auth/user'

// Wire schemas for the current session, shared by every route that exposes a
// signed-in identity (`/auth/me`, `/users/me`, `/auth/dev-login`) and by the
// legacy session shape. Keeping them outside the auth feature means a route
// group like `/users/me` does not depend on auth-route internals.
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
export const role = t.Union([ROLE.USER, ROLE.ADMIN, ROLE.SUPERUSER])

/** A signed-in identity as `/auth/me`, `/users/me` and `/auth/dev-login` expose it. */
export const sessionUser = t.Object({
  signed: t.Literal(true),
  id: t.String(),
  name: t.String(),
  // Sigarra does not always release an email, so the stored value can be null.
  email: t.Union([t.String(), t.Null()]),
  isAdmin: t.Boolean(),
  role,
})

/** The signed-out marker returned by `/auth/logout` and the legacy `/auth/info/`. */
export const anonymous = t.Object({ signed: t.Literal(false) })
