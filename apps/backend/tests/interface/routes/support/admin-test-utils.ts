import type { AuthUser, UserRole } from '@/core/auth/user'
import type { AdminRepository } from '@/domain/ports/admin.repository'
import type { Course } from '@/domain/ports/course.repository'
import type { CourseUnit } from '@/domain/ports/course-unit.repository'
import type { Occurrence, OccurrenceWithUnit } from '@/domain/ports/occurrence.repository'
import { createApp } from '@/main'

import { ADMIN, createFakeSessions } from './auth-test-utils'
import { COURSES, COURSE_UNITS, OCCURRENCES } from './catalog-test-utils'
import { createGet } from './user-test-utils'

// Harness for the `/v1/admin/*` route tests. Same idea as `createUsersApp`:
// the real app through `app.handle(request)`, fake repositories, no database.
//
// The fake `AdminRepository` follows the same rules as the Prisma one: scope
// comes only from the two scope tables, an occurrence is the `(id, year)` pair,
// and the results are ordered the same way. So the tests check real behaviour,
// not just that a fixture is passed through.

export type OccurrenceKey = { id: number; year: number }

export type AdminScopeFixtures = {
  /** `AdminCourse` rows: user id → course ids. */
  courseScopes?: Record<string, number[]>
  /** `AdminOccurrence` rows: user id → `(id, year)` pairs. */
  occurrenceScopes?: Record<string, OccurrenceKey[]>
  courses?: Course[]
  occurrences?: Occurrence[]
  courseUnits?: CourseUnit[]
}

export function createFakeAdminRepository({
  courseScopes = {},
  occurrenceScopes = {},
  courses = COURSES,
  occurrences = OCCURRENCES,
  courseUnits = COURSE_UNITS,
}: AdminScopeFixtures = {}): AdminRepository {
  return {
    async findCoursesByAdmin(userId) {
      const ids = courseScopes[userId] ?? []

      // `filter` returns a fresh array, so sorting never mutates the fixture.
      return courses.filter((course) => ids.includes(course.id)).sort((a, b) => a.acronym.localeCompare(b.acronym))
    },

    async findOccurrencesByAdmin(userId) {
      const scope = occurrenceScopes[userId] ?? []
      const result: OccurrenceWithUnit[] = []

      for (const occurrence of occurrences) {
        // Match on the pair (id, year): the id alone repeats across years.
        if (!scope.some((key) => key.id === occurrence.id && key.year === occurrence.year)) continue

        const unit = courseUnits.find((u) => u.id === occurrence.courseUnitId)
        if (!unit) continue

        result.push({ ...occurrence, acronym: unit.acronym, name: unit.name })
      }

      return result.sort((a, b) => b.year - a.year || a.id - b.id)
    },
  }
}

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
