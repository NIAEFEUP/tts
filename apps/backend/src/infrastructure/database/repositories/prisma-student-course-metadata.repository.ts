import type { StudentCourseMetadataRepository } from '@/domain/ports/student-course-metadata.repository'
import type { Db } from '@/infrastructure/database/prisma'

/** Prisma implementation of `StudentCourseMetadataRepository`. */
export function createStudentCourseMetadataRepository({ db }: { db: Db }): StudentCourseMetadataRepository {
  return {
    // GET /v1/students/:nmec/courses/:courseId/metadata — (nmec, courseId) is the primary key.
    async find(nmec, courseId) {
      const row = await db.orm.public.StudentCourseMetadata.where({ nmec, courseId })
        .select('courseId', 'festId')
        .first()

      return row ?? null
    },
  }
}
