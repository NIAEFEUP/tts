import { and } from '@prisma/orm-postgres/orm-client'

import type { Occurrence, OccurrenceRepository, OccurrenceWithUnit } from '@/domain/ports/occurrence.repository'
import type { Db } from '@/infrastructure/database/prisma'

/**
 * The `Occurrence` columns every occurrence read projects. One source of truth:
 * a column added or renamed in `contract.prisma` is fixed here once, and all
 * three reads pick it up. `as const` keeps the literal tuple so `.select(...)`
 * stays checked against the contract; `satisfies readonly (keyof Occurrence)[]`
 * ties the list to the port, so dropping or renaming a DTO field fails here
 * instead of at each call site.
 */
const OCCURRENCE_COLUMNS = [
  'id',
  'courseUnitId',
  'courseId',
  'year',
  'ects',
  'url',
  'hash',
] as const satisfies readonly (keyof Occurrence)[]

/**
 * Single occurrence by its composite primary key `(id, year)`, joined with the
 * course unit's human-readable fields so the endpoint needs no second
 * round-trip.
 */
const findOccurrenceWithUnit = (db: Db, id: number, year: number) =>
  db.orm.public.Occurrence.where((occurrence) => and(occurrence.id.eq(id), occurrence.year.eq(year)))
    .include('courseUnit', (unit) => unit.select('acronym', 'name', 'courseUnitYear'))
    .select(...OCCURRENCE_COLUMNS)
    .first()

/**
 * The row the query above returns. Derived from the ORM instead of re-declared,
 * so the mapper cannot drift from the contract.
 */
type OccurrenceWithUnitRow = NonNullable<Awaited<ReturnType<typeof findOccurrenceWithUnit>>>

/**
 * Projects an occurrence row joined with its course unit onto the port's DTO —
 * the only place the enriched single-occurrence shape is built.
 */
function toOccurrenceWithUnit(row: OccurrenceWithUnitRow): OccurrenceWithUnit {
  // The `courseUnit` relation is required in the contract (no `?`) and
  // protected by `onDelete: Cascade`, so it can never be null in practice.
  // The ORM still types included to-one relations as nullable, so a guard
  // is needed to satisfy the compiler.
  if (!row.courseUnit) throw new Error(`Occurrence (${row.id}, ${row.year}) has no course unit`)

  return {
    id: row.id,
    courseUnitId: row.courseUnitId,
    courseId: row.courseId,
    year: row.year,
    ects: row.ects,
    url: row.url,
    hash: row.hash,
    acronym: row.courseUnit.acronym,
    name: row.courseUnit.name,
    courseUnitYear: row.courseUnit.courseUnitYear,
  }
}

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
        .select(...OCCURRENCE_COLUMNS)
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
      const { year, semester } = filter

      let query = db.orm.public.Occurrence.where((occurrence) => occurrence.courseId.eq(courseId))
        .include('courseUnit', (unit) => unit.select('acronym', 'name', 'courseUnitYear'))
        .select(...OCCURRENCE_COLUMNS)

      if (year !== undefined) {
        query = query.where((occurrence) => occurrence.year.eq(year))
      }

      if (semester !== undefined) {
        // `semester` lives on CourseUnit, not Occurrence. Resolve the matching
        // unit ids first, then filter the occurrence foreign key with `in`.
        const courseUnits = await db.orm.public.CourseUnit.where((unit) =>
          and(unit.courseId.eq(courseId), unit.semester.eq(semester)),
        )
          .select('id')
          .all()

        query = query.where((occurrence) => occurrence.courseUnitId.in(courseUnits.map((unit) => unit.id)))
      }

      const rows = await query
        .orderBy([(occurrence) => occurrence.year.desc(), (occurrence) => occurrence.id.asc()])
        .all()

      return rows.map(toOccurrenceWithUnit)
    },

    // GET /v1/occurrences/:id — single occurrence by its composite primary
    // key `(id, year)`. Returns null when no row matches — the route turns
    // this into a 404.
    async findById(id, year): Promise<OccurrenceWithUnit | null> {
      const occurrence = await findOccurrenceWithUnit(db, id, year)

      return occurrence ? toOccurrenceWithUnit(occurrence) : null
    },
  }
}
