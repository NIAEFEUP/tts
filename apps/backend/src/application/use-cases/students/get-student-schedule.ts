import { isAdmin, type AuthUser } from '@/core/auth/user'
import { createGetSchedule, type ScheduleEntry } from '@/application/use-cases/schedule/get-schedule'
import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'

export function createGetStudentSchedule(deps: { enrollments: EnrollmentRepository }) {
  const getSchedule = createGetSchedule(deps)

  /**
   * Another student's schedule, or `null` when `viewer` may not see it. Allowed
   * for admins, for the student themselves, and for students who share an
   * occurrence (same id and year) with them.
   */
  return async function getStudentSchedule(viewer: AuthUser, studentId: string): Promise<ScheduleEntry[] | null> {
    const allowed =
      isAdmin(viewer) || viewer.id === studentId || (await deps.enrollments.sharesOccurrence(viewer.id, studentId))

    return allowed ? getSchedule(studentId) : null
  }
}
