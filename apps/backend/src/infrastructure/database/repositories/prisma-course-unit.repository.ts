import type { CourseUnitRepository, CourseUnitSemester } from '@/domain/ports/course-unit.repository'
import type { Db } from '@/infrastructure/database/prisma'

/**
 * `semester` is an `int` column, so Prisma types it as `number`; the domain
 * only allows 1 or 2. Narrowing it at the boundary makes a corrupt row fail
 * here instead of reaching a response schema that would reject it.
 */
function toCourseUnitSemester(value: number): CourseUnitSemester {
  if (value === 1 || value === 2) return value

  throw new Error(`CourseUnit row has an invalid semester: ${value}`)
}

/**
 * Prisma implementation of `CourseUnitRepository`.
 *
 * A `CourseUnit` row is the abstract, year-agnostic template ("BD" — Bases de
 * Dados). It carries no classes or periods — those belong to `Occurrence`.
 *
 * This is a factory function: it receives a database connection and returns
 * an object matching the CourseUnitRepository interface. The route never calls
 * this directly — it's wired up in main.ts via createRepositories(db).
 */
export function createCourseUnitRepository({ db }: { db: Db }): CourseUnitRepository {
  return {
    // GET /v1/course-units/:id — one course unit by its id.
    async findById(id) {
      const row = await db.orm.public.CourseUnit.where({ id })
        .select('id', 'courseId', 'acronym', 'name', 'semester')
        .first()

      if (!row) return null

      return { ...row, semester: toCourseUnitSemester(row.semester) }
    },

    // GET /v1/courses/:id/units — every unit the course offers, by acronym.
    async findByCourse(courseId) {
      const rows = await db.orm.public.CourseUnit.where((unit) => unit.courseId.eq(courseId))
        .select('id', 'courseId', 'acronym', 'name', 'semester')
        .orderBy((unit) => unit.acronym.asc())
        .all()

      return rows.map((row) => ({ ...row, semester: toCourseUnitSemester(row.semester) }))
    },
  }
}
