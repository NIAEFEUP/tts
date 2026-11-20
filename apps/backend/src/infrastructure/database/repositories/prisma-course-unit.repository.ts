import type { CourseUnitRepository } from '@/domain/ports/course-unit.repository'
import type { Db } from '@/infrastructure/database/prisma'

import { COURSE_UNIT_FIELDS, toCourseUnit } from './course-unit-mapper'

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
        .select(...COURSE_UNIT_FIELDS)
        .first()

      return row ? toCourseUnit(row) : null
    },

    // GET /v1/courses/:id/units — every unit the course offers, by acronym.
    async findByCourse(courseId) {
      const rows = await db.orm.public.CourseUnit.where((unit) => unit.courseId.eq(courseId))
        .select(...COURSE_UNIT_FIELDS)
        .orderBy((unit) => unit.acronym.asc())
        .all()

      return rows.map(toCourseUnit)
    },
  }
}
