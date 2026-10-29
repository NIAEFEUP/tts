import { and } from '@prisma/orm-postgres/orm-client'

import type { OccurrenceRepository, OccurrenceWithUnit } from '@/domain/ports/occurrence.repository'
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

    // GET /v1/courses/:id/occurrences — occurrences for one course, optionally
    // narrowed by academic year and/or semester. Year lives on Occurrence
    // directly; semester lives on the related CourseUnit, so filtering by it
    // traverses the `courseUnit` relation inside the predicate. Chained
    // `.where()` clauses AND-compose, so each optional filter is added only
    // when provided rather than building a single combined expression.
    async findByCourse(courseId, filter = {}) {
      let query = db.orm.public.Occurrence.where((occurrence) => occurrence.courseId.eq(courseId)).select(
        'id',
        'courseUnitId',
        'courseId',
        'year',
        'ects',
        'url',
        'hash',
      )

      if (filter.year !== undefined) {
        query = query.where((occurrence) => occurrence.year.eq(filter.year!))
      }

      if (filter.semester !== undefined) {
        // `semester` lives on CourseUnit, not Occurrence. Resolve the matching
        // unit ids first, then filter the occurrence foreign key with `in`.
        const courseUnits = await db.orm.public.CourseUnit.where((unit) =>
          and(unit.courseId.eq(courseId), unit.semester.eq(filter.semester!)),
        )
          .select('id')
          .all()

        query = query.where((occurrence) => occurrence.courseUnitId.in(courseUnits.map((unit) => unit.id)))
      }

      return query.orderBy([(occurrence) => occurrence.year.desc(), (occurrence) => occurrence.id.asc()]).all()
    },

    // GET /v1/occurrences/:id — single occurrence by its composite primary
    // key `(id, year)`. Joined with `courseUnit` to attach the unit's name
    // and acronym, so the endpoint returns the enriched shape without a
    // second round-trip. Returns null when no row matches — the route turns
    // this into a 404.
    async findById(id, year): Promise<OccurrenceWithUnit | null> {
      const occurrence = await db.orm.public.Occurrence.where((o) => and(o.id.eq(id), o.year.eq(year)))
        .include('courseUnit', (unit) => unit.select('acronym', 'name'))
        .first()

      if (!occurrence) return null

      // The `courseUnit` relation is required in the contract (no `?`) and
      // protected by `onDelete: Cascade`, so it can never be null in practice.
      // The ORM still types included to-one relations as nullable, so a guard
      // is needed to satisfy the compiler.
      if (!occurrence.courseUnit) throw new Error(`Occurrence (${id}, ${year}) has no course unit`)

      return {
        id: occurrence.id,
        courseUnitId: occurrence.courseUnitId,
        courseId: occurrence.courseId,
        year: occurrence.year,
        ects: occurrence.ects,
        url: occurrence.url,
        hash: occurrence.hash,
        acronym: occurrence.courseUnit.acronym,
        name: occurrence.courseUnit.name,
      }
    },
  }
}
