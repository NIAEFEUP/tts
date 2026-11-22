import type { CourseUnit, CourseUnitSemester, CourseUnitYear } from '@/domain/ports/course-unit.repository'

/**
 * Narrowing helpers for the `CourseUnit` columns the catalog exposes. Prisma
 * types both as `number` because the contract stores them as `int`, while the
 * domain only allows 1 | 2 and 1..6. Failing here makes a corrupt row stop at
 * the repository instead of reaching a response schema that would reject it.
 */

export function toCourseUnitSemester(value: number): CourseUnitSemester {
  if (value === 1 || value === 2) return value

  throw new Error(`CourseUnit row has an invalid semester: ${value}`)
}

export function toCourseUnitYear(value: number): CourseUnitYear {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6) return value

  throw new Error(`CourseUnit row has an invalid courseUnitYear: ${value}`)
}

/** The columns every course-unit read projects. Shared by both read methods. */
export const COURSE_UNIT_FIELDS = ['id', 'courseId', 'acronym', 'name', 'semester', 'courseUnitYear'] as const

type CourseUnitRow = {
  id: number
  courseId: number
  acronym: string
  name: string
  semester: number
  courseUnitYear: number
}

/** Projects a raw `CourseUnit` row onto the port's DTO. */
export function toCourseUnit(row: CourseUnitRow): CourseUnit {
  return {
    id: row.id,
    courseId: row.courseId,
    acronym: row.acronym,
    name: row.name,
    semester: toCourseUnitSemester(row.semester),
    courseUnitYear: toCourseUnitYear(row.courseUnitYear),
  }
}
