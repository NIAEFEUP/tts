import type { AuthUser } from '@/core/auth/user'
import type { EnrollmentRepository, StudentEnrollment } from '@/domain/ports/enrollment.repository'
import type {
  StudentCourseMetadata,
  StudentCourseMetadataRepository,
} from '@/domain/ports/student-course-metadata.repository'
import { createApp } from '@/main'

import { createFakeSessions, createFakeUserDirectory } from './auth-test-utils'
import { createGet } from './user-test-utils'

// Harness for the `/v1/students/*` route tests, on top of `createGet`.
//
// Student NMECs are bare digits, as in `User.id`; `normalizeNmec` maps the
// `up…` form onto them.

const student = (id: string, name: string, role: AuthUser['role'] = 'USER'): AuthUser => ({
  id,
  name,
  email: `up${id}@up.pt`,
  role,
})

export const VIEWER = student('202000001', 'Vera Viewer')
export const CLASSMATE = student('202000002', 'Carlos Classmate')
export const STRANGER = student('202000003', 'Sara Stranger')
export const STUDENT_ADMIN = student('202000004', 'Ana Admin', 'ADMIN')

/** One enrollment in `(occurrenceId, year)`, in a class named after `classId`. */
export function enrollmentIn(occurrenceId: number, year: number, classId: number): StudentEnrollment {
  return {
    occurrence: {
      id: occurrenceId,
      year,
      courseUnit: { id: occurrenceId, acronym: `UC${occurrenceId}`, name: `Unit ${occurrenceId}`, semester: 1 },
    },
    class: { id: classId, name: `1LEIC0${classId}`, vacancies: null, slots: [] },
  }
}

/**
 * Enrollments by student. `sharesOccurrence` compares `(id, year)` pairs like
 * the real repository, and every call is recorded so a test can assert that
 * the admin and self shortcuts never reach it.
 */
export function createFakeEnrollments(byUser: Record<string, StudentEnrollment[]>) {
  const sharesOccurrenceCalls: Array<[string, string]> = []
  const keys = (userId: string) => (byUser[userId] ?? []).map(({ occurrence }) => `${occurrence.id}:${occurrence.year}`)

  const repository: EnrollmentRepository = {
    findByUserId: async (userId) => byUser[userId] ?? [],
    sharesOccurrence: async (userIdA, userIdB) => {
      sharesOccurrenceCalls.push([userIdA, userIdB])
      const a = new Set(keys(userIdA))
      return keys(userIdB).some((key) => a.has(key))
    },
  }

  return { repository, sharesOccurrenceCalls }
}

export function createFakeStudentCourseMetadata(
  rows: Array<StudentCourseMetadata & { nmec: string }>,
): StudentCourseMetadataRepository {
  return {
    find: async (nmec, courseId) => {
      const row = rows.find((candidate) => candidate.nmec === nmec && candidate.courseId === courseId)
      return row ? { courseId: row.courseId, festId: row.festId } : null
    },
  }
}

type StudentsAppOptions = {
  /** The signed-in caller. */
  viewer?: AuthUser
  /** Every student that exists. Defaults to the four fixtures above. */
  users?: AuthUser[]
  enrollments?: EnrollmentRepository
  metadata?: StudentCourseMetadataRepository
}

export function createStudentsApp({
  viewer = VIEWER,
  users = [VIEWER, CLASSMATE, STRANGER, STUDENT_ADMIN],
  enrollments = createFakeEnrollments({}).repository,
  metadata = createFakeStudentCourseMetadata([]),
}: StudentsAppOptions = {}) {
  const app = createApp({
    repositories: {
      userRepository: createFakeUserDirectory(users),
      enrollmentRepository: enrollments,
      studentCourseMetadataRepository: metadata,
      sessionRepository: createFakeSessions(viewer),
    },
  })

  return { app, get: createGet(app) }
}

/** Error bodies of the `/v1/students` routes, so tests assert shapes, not literals. */
export const FORBIDDEN_BODY = { error: 'Not allowed', code: 'forbidden' }
export const studentNotFoundBody = (nmec: string) => ({
  error: `Student ${nmec} not found`,
  code: 'student-not-found',
})
