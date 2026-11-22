import type { CourseUnit } from '@/domain/ports/course-unit.repository'
import type { OccurrenceWithUnit } from '@/domain/ports/occurrence.repository'

import { toCourseUnitYear } from './course-unit-mapper'

/**
 * The `CourseUnit` columns every enriched occurrence read projects. One source
 * of truth for the three reads that join the unit — a course-unit field added
 * or renamed is fixed here once.
 */
export const COURSE_UNIT_COLUMNS = [
  'acronym',
  'name',
  'courseUnitYear',
] as const satisfies readonly (keyof CourseUnit)[]

/**
 * The shape an occurrence read returns: the `Occurrence` columns plus the
 * included `CourseUnit` projection above. Structural on purpose, so every
 * repository that selects this projection can pass its rows to the mapper.
 */
export type OccurrenceWithUnitRow = {
  id: number
  courseUnitId: number
  courseId: number
  year: number
  ects: number
  url: string
  hash: string
  courseUnit: {
    acronym: string
    name: string
    courseUnitYear: number
  } | null
}

/**
 * Projects an occurrence row joined with its course unit onto the port's DTO —
 * the only place the enriched shape is built.
 */
export function toOccurrenceWithUnit(row: OccurrenceWithUnitRow): OccurrenceWithUnit {
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
    courseUnitYear: toCourseUnitYear(row.courseUnit.courseUnitYear),
  }
}
