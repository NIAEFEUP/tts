import type { CourseRepository } from '@/domain/ports/course.repository'
import type { Db } from '@/infrastructure/database/prisma'

import { attachFaculties, loadCourses, toCourseRow } from './course-mapper'

/**
 * Prisma implementation of `CourseRepository`.
 *
 * `faculty` filtering goes through the `FacultyCourse` join table first: find
 * the course ids a faculty offers, then let the shared mapper fetch them and
 * attach every offering faculty. An unknown faculty simply yields no ids —
 * an empty list, not an error.
 *
 * This is a factory function: it receives a database connection and returns
 * an object matching the CourseRepository interface. The route never calls
 * this directly — it's wired up in main.ts via createRepositories(db).
 */
export function createCourseRepository({ db }: { db: Db }): CourseRepository {
  return {
    // GET /v1/courses?year=2025&faculty=FEUP — the full catalog, filtered
    async findAll(filter = {}) {
      const { year, faculty } = filter

      let ids: number[] | undefined
      if (faculty !== undefined) {
        const links = await db.orm.public.FacultyCourse.where((link) => link.facultyId.eq(faculty)).all()
        ids = links.map((link) => link.courseId)
        // No course is offered by this faculty — nothing left to query
        if (ids.length === 0) return []
      }

      return loadCourses(db, { ids, year })
    },

    // GET /v1/courses/:id — one course plus its offering faculties
    async findById(id) {
      // `.where({ id }).first()` returns one row or null (route converts to 404)
      const row = await db.orm.public.Course.where({ id }).first()
      if (!row) return null

      const [course] = await attachFaculties(db, [toCourseRow(row)])
      return course!
    },
  }
}
