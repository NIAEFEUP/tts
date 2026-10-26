import type { StudentRepository } from '@/domain/ports/student.repository'
import type { Db } from '@/infrastructure/database/prisma'

/** Prisma implementation of `StudentRepository`. Only `id` and `name` are ever read off `User`. */
export function createStudentRepository({ db }: { db: Db }): StudentRepository {
  return {
    async findProfile(nmec) {
      const row = await db.orm.public.User.select('id', 'name').where({ id: nmec }).first()
      return row ? { nmec: row.id, name: row.name } : null
    },

    async findCourseMetadata(nmec, courseId) {
      const row = await db.orm.public.StudentCourseMetadata.where({ nmec, courseId }).first()
      return row ? { nmec: row.nmec, courseId: row.courseId, festId: row.festId } : null
    },
  }
}
