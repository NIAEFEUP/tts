import type { StudentProfile, StudentRepository } from '@/domain/ports/student.repository'

export type GetStudentProfileResult = { ok: true; profile: StudentProfile } | { ok: false; reason: 'student-not-found' }

/** Any signed-in user may read another student's name; nothing else is exposed. */
export function createGetStudentProfile(deps: { students: StudentRepository }) {
  return async function getStudentProfile(nmec: string): Promise<GetStudentProfileResult> {
    const profile = await deps.students.findProfile(nmec)
    return profile ? { ok: true, profile } : { ok: false, reason: 'student-not-found' }
  }
}
