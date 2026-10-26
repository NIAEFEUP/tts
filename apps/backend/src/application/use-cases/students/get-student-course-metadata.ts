import { isAdmin } from '@/core/auth/user'
import type { AuthUser } from '@/core/auth/user'
import type { StudentCourseMetadata, StudentRepository } from '@/domain/ports/student.repository'

export type GetStudentCourseMetadataResult =
  | { ok: true; metadata: StudentCourseMetadata }
  | { ok: false; reason: 'student-not-found' | 'metadata-not-found' | 'forbidden' }

/**
 * Admin-only. The role is checked before any lookup so a non-admin gets a 403
 * whether or not the student exists, instead of learning which NMECs are known.
 */
export function createGetStudentCourseMetadata(deps: { students: StudentRepository }) {
  return async function getStudentCourseMetadata(
    caller: AuthUser,
    nmec: string,
    courseId: number,
  ): Promise<GetStudentCourseMetadataResult> {
    if (!isAdmin(caller)) return { ok: false, reason: 'forbidden' }

    const profile = await deps.students.findProfile(nmec)
    if (!profile) return { ok: false, reason: 'student-not-found' }

    const metadata = await deps.students.findCourseMetadata(profile.nmec, courseId)
    return metadata ? { ok: true, metadata } : { ok: false, reason: 'metadata-not-found' }
  }
}
