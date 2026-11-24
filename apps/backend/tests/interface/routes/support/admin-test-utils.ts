import type { AuthUser, UserRole } from '@/core/auth/user'
import type { AdminRepository } from '@/domain/ports/admin.repository'
import { createApp } from '@/main'

import { ADMIN, createFakeSessions } from './auth-test-utils'
import { createFakeAdminRepository } from './catalog-test-utils'
import type { AdminScopeFixtures } from './catalog-test-utils'
import { createGet } from './user-test-utils'

export { createFakeAdminRepository } from './catalog-test-utils'
export type { AdminScopeFixtures, OccurrenceKey } from './catalog-test-utils'

// Harness for the `/v1/admin/*` route tests. Same idea as `createUsersApp`:
// the real app through `app.handle(request)`, fake repositories, no database.
//
// The fake `AdminRepository` follows the same rules as the Prisma one: scope
// comes only from the two scope tables, an occurrence is the `(id, year)` pair,
// and the results are ordered the same way. So the tests check real behaviour,
// not just that a fixture is passed through.

/** `ADMIN` by default; pass `'USER'` or `'SUPERUSER'` for the other tiers. */
export function userWithRole(role: UserRole): AuthUser {
  return { ...ADMIN, role }
}

type AdminAppOptions = AdminScopeFixtures & {
  /** Role of the signed-in session. Defaults to `ADMIN`. */
  role?: UserRole
  /** Replace the fake repository outright. */
  adminRepository?: AdminRepository
}

/** The app with the fake admin repository and a signed-in session of `role`. */
export function createAdminApp({ role = 'ADMIN', adminRepository, ...fixtures }: AdminAppOptions = {}) {
  const app = createApp({
    repositories: {
      adminRepository: adminRepository ?? createFakeAdminRepository(fixtures),
      sessionRepository: createFakeSessions(userWithRole(role)),
    },
  })

  return { app, get: createGet(app) }
}
