import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { Db } from '@/infrastructure/database/prisma'

/**
 * Prisma implementation of `OccurrenceRepository`.
 *
 * An `Occurrence` row is the concrete (course unit, course, academic year)
 * tuple — the place where a course unit is actually taught. Its primary key
 * is the composite `(id, year)`, because Sigarra reuses the same occurrence
 * id across academic years, so `id` alone is not unique.
 *
 * This is a factory function: it receives a database connection and returns
 * an object matching the OccurrenceRepository interface. The route never calls
 * this directly — it's wired up in main.ts via createRepositories(db).
 */
export function createOccurrenceRepository({ db }: { db: Db }): OccurrenceRepository {
  return {
    // GET /v1/course-units/:id/occurrences — every occurrence of one abstract
    // course unit, across every course and academic year it is taught in.
    async findByCourseUnit(courseUnitId) {
      return db.orm.public.Occurrence.where((occurrence) => occurrence.courseUnitId.eq(courseUnitId))
        .select('id', 'courseUnitId', 'courseId', 'year', 'ects', 'url', 'hash')
        .orderBy([(occurrence) => occurrence.year.desc(), (occurrence) => occurrence.id.asc()])
        .all()
    },
  }
}
