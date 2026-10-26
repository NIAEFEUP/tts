import { isAdmin } from '@/core/auth/user'
import type { AuthUser } from '@/core/auth/user'
import type { ScheduleRepository, ScheduledClass } from '@/domain/ports/schedule.repository'
import type { StudentRepository } from '@/domain/ports/student.repository'

export type GetStudentScheduleResult =
  | { ok: true; classes: ScheduledClass[] }
  | { ok: false; reason: 'student-not-found' | 'forbidden' }

/**
 * A schedule is visible to its owner, to admins, and to participants — students
 * enrolled in a class of the same course (degree). The student must exist
 * before access is judged, so an unknown NMEC is a 404 for everyone.
 */
export function createGetStudentSchedule(deps: { students: StudentRepository; schedules: ScheduleRepository }) {
  return async function getStudentSchedule(caller: AuthUser, nmec: string): Promise<GetStudentScheduleResult> {
    const profile = await deps.students.findProfile(nmec)
    if (!profile) return { ok: false, reason: 'student-not-found' }

    const allowed =
      caller.id === profile.nmec || isAdmin(caller) || (await deps.schedules.sharesCourse(caller.id, profile.nmec))
    if (!allowed) return { ok: false, reason: 'forbidden' }

    return { ok: true, classes: await deps.schedules.findByStudent(profile.nmec) }
  }
}
