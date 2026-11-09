import { t } from 'elysia'

import { anonymous, role } from '../session/session.schemas'

// Wire schemas specific to the auth compatibility surface. The signed-in
// session shape (`sessionUser`) and the signed-out marker (`anonymous`) live in
// `../session/session.schemas`, shared with the canonical routes so every
// identity is described identically.

/** A raw identity record, as the legacy `/sigarra_login/` returns it. */
export const userProfile = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.Union([t.String(), t.Null()]),
  role,
})

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
