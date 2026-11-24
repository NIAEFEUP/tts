import type { AuthUser, UserRole } from '@/core/auth/user'
import type { AdminRepository } from '@/domain/ports/admin.repository'
import type {
  AdminEnrollmentRequest,
  AdminEnrollmentRequestRepository,
} from '@/domain/ports/admin-enrollment-request.repository'
import type { EnrollmentRequest, EnrollmentRequestAdminState } from '@/domain/ports/enrollment-request.repository'
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

        result.push({ ...occurrence, acronym: unit.acronym, name: unit.name, courseUnitYear: unit.courseUnitYear })
      }

      return result.sort((a, b) => b.year - a.year || a.id - b.id)
    },
  }
}

// Same rule as the Prisma repository: only these admin states can still be decided.
const DECIDABLE_ADMIN_STATES: EnrollmentRequestAdminState[] = ['UNTREATED', 'AWAITING_INFORMATION']

const isDecidable = (request: EnrollmentRequest) =>
  request.status === 'PENDING' && DECIDABLE_ADMIN_STATES.includes(request.adminState)

/** The student name the fake admin repository attaches to every request. */
export const fakeUserName = (userId: string) => `Student ${userId}`

const withUserName = (request: EnrollmentRequest): AdminEnrollmentRequest => ({
  ...structuredClone(request),
  userName: fakeUserName(request.userId),
})

/** One row of the `Enrollment` table: a student in a class. */
export type FakeEnrollment = { userId: string; classId: string }

/** The two classes the fake gives every occurrence that has classes; `T1` sorts first. */
export const fakeClassIds = (occurrenceId: number, occurrenceYear: number) => [
  `${occurrenceId}-${occurrenceYear}-T1`,
  `${occurrenceId}-${occurrenceYear}-T2`,
]

export type FakeAdminEnrollmentRequestOptions = {
  /** `AdminOccurrence` rows: admin user id → `(id, year)` pairs. No entry means no scope. */
  occurrenceScopes?: Record<string, OccurrenceKey[]>
  /** Occurrences that have no classes: accepting an enroll option on them cannot be applied. */
  occurrencesWithoutClasses?: OccurrenceKey[]
  /** The `Enrollment` table. Mutated in place by accept, so tests can assert on it. */
  enrollments?: FakeEnrollment[]
}

type RequestOption = EnrollmentRequest['options'][number]

/**
 * Fake of the admin request repository, with the same rules as the Prisma one:
 * the admin sees only requests with at least one option in their occurrence
 * scope, a decision needs every option in scope, accept enrolls the student in
 * one class per occurrence (the lowest id) and drop removes the enrollments of
 * that occurrence. Pass a `Map` to share the store with the student repository,
 * so a withdrawal is visible to the admin list.
 */
export function createFakeAdminEnrollmentRequestRepository(
  source: EnrollmentRequest[] | Map<string, EnrollmentRequest> = [],
  { occurrenceScopes = {}, occurrencesWithoutClasses = [], enrollments = [] }: FakeAdminEnrollmentRequestOptions = {},
): AdminEnrollmentRequestRepository {
  const store = Array.isArray(source)
    ? new Map(source.map((request) => [request.id, structuredClone(request)]))
    : source

  // Match on the pair (id, year): the id alone repeats across years.
  const inScope = (scope: OccurrenceKey[], option: RequestOption) =>
    scope.some((key) => key.id === option.occurrence.id && key.year === option.occurrence.year)

  const classesOf = (option: RequestOption) =>
    occurrencesWithoutClasses.some((key) => key.id === option.occurrence.id && key.year === option.occurrence.year)
      ? []
      : fakeClassIds(option.occurrence.id, option.occurrence.year)

  // Checks shared by accept and reject, in the order the Prisma repository runs them.
  const check = (adminUserId: string, id: string) => {
    const request = store.get(id)
    if (!request) return { kind: 'not-found' as const }
    if (!isDecidable(request)) return { kind: 'not-pending' as const }

    const scope = occurrenceScopes[adminUserId] ?? []
    if (request.options.length === 0 || request.options.some((option) => !inScope(scope, option)))
      return { kind: 'forbidden' as const }

    return { kind: 'checked' as const, request }
  }

  return {
    async findForAdmin(adminUserId, filters) {
      const scope = occurrenceScopes[adminUserId] ?? []

      const all = [...store.values()]
        // Withdrawn requests are not for the admin to decide, so they are not listed.
        .filter((request) => request.status !== 'CANCELLED')
        // Only the options in scope count, also for the course and year filters.
        .map((request) => ({ request, scoped: request.options.filter((option) => inScope(scope, option)) }))
        .filter(({ scoped }) => scoped.length > 0)
        .filter(({ request }) => !filters.activeStates?.length || filters.activeStates.includes(request.adminState))
        .filter(({ scoped }) => {
          if (filters.activeCourse === undefined) return true
          return scoped.some((option) =>
            OCCURRENCES.some(
              (occurrence) =>
                occurrence.id === option.occurrence.id &&
                occurrence.year === option.occurrence.year &&
                occurrence.courseId === filters.activeCourse,
            ),
          )
        })
        .filter(({ scoped }) => {
          if (filters.activeCurricularYear === undefined) return true
          return scoped.some((option) =>
            COURSE_UNITS.some(
              (unit) =>
                unit.id === option.occurrence.courseUnit.id && unit.courseUnitYear === filters.activeCurricularYear,
            ),
          )
        })
        .map(({ request }) => request)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      const offset = (filters.page - 1) * filters.pageSize
      return {
        requests: all.slice(offset, offset + filters.pageSize).map(withUserName),
        page: filters.page,
        pageSize: filters.pageSize,
        total: all.length,
        totalPages: all.length === 0 ? 0 : Math.ceil(all.length / filters.pageSize),
      }
    },

    async acceptForAdmin(adminUserId, id) {
      const checked = check(adminUserId, id)
      if (checked.kind !== 'checked') return checked
      const { request } = checked

      const plans = request.options.map((option) => ({ option, classes: classesOf(option) }))
      // Pending but not applicable: nothing changes.
      if (plans.some(({ option, classes }) => option.enrolling && classes.length === 0))
        return { kind: 'occurrence-has-no-classes' as const }

      request.status = 'ACCEPTED'
      request.adminState = 'TREATED'
      request.updatedAt = new Date()

      for (const { option, classes } of plans) {
        if (classes.length === 0) continue

        const inOccurrence = (enrollment: FakeEnrollment) =>
          enrollment.userId === request.userId && classes.includes(enrollment.classId)

        if (option.enrolling) {
          // One class per occurrence; nothing to add if the student is already in one.
          const [target] = [...classes].sort()
          if (target && !enrollments.some(inOccurrence)) enrollments.push({ userId: request.userId, classId: target })
        } else {
          for (let index = enrollments.length - 1; index >= 0; index--) {
            if (inOccurrence(enrollments[index]!)) enrollments.splice(index, 1)
          }
        }
      }

      return { kind: 'ok' as const, request: withUserName(request) }
    },

    async rejectForAdmin(adminUserId, id) {
      const checked = check(adminUserId, id)
      if (checked.kind !== 'checked') return checked
      const { request } = checked

      request.adminState = 'REJECTED'
      request.updatedAt = new Date()
      return { kind: 'ok' as const, request: withUserName(request) }
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
