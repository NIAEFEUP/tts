import { isAdmin, type AuthUser } from '@/core/auth/user'
import type {
  StudentCourseMetadata,
  StudentCourseMetadataRepository,
} from '@/domain/ports/student-course-metadata.repository'

export type StudentCourseMetadataResult =
  | { kind: 'ok'; metadata: StudentCourseMetadata }
  | { kind: 'forbidden' }
  | { kind: 'not-found' }

export function createGetStudentCourseMetadata(deps: { metadata: StudentCourseMetadataRepository }) {
  /**
   * A student's metadata in one course, or `forbidden` when `viewer` is not an
   * admin, or `not-found` when none was scraped.
   */
  return async function getStudentCourseMetadata(
    viewer: AuthUser,
    studentId: string,
    courseId: number,
  ): Promise<StudentCourseMetadataResult> {
    if (!isAdmin(viewer)) return { kind: 'forbidden' }

    const metadata = await deps.metadata.find(studentId, courseId)
    return metadata ? { kind: 'ok', metadata } : { kind: 'not-found' }
  }
}
