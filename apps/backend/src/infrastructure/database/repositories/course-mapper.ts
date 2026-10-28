import type { Course } from '@/domain/ports/course.repository'
import type { Db } from '@/infrastructure/database/prisma'

/**
 * Shared course-catalog reads. `FacultyCourse` is an explicit m2m join (Prisma 8
 * has no implicit m2m), so resolving a course's faculties always takes a second
 * query. Both `prisma-faculty.repository.ts` and `prisma-course.repository.ts`
 * compose these helpers instead of re-implementing the join.
 */

/** A course row reduced to the fields the API exposes (`faculties` not yet joined). */
export type CourseRow = Omit<Course, 'faculties'>

export type CourseQuery = {
  /** Restrict to these course ids — a `FacultyCourse` join result. */
  ids?: number[]
  /** Restrict to one academic year */
  year?: number
}

/** Pick the API-facing fields out of a raw `Course` table row. */
export function toCourseRow(row: {
  id: number
  acronym: string
  name: string
  courseType: string
  year: number
  url: string
}): CourseRow {
  return {
    id: row.id,
    acronym: row.acronym,
    name: row.name,
    courseType: row.courseType,
    year: row.year,
    url: row.url,
  }
}

/**
 * Fetch `Course` rows matching the query, ordered by acronym. The branches are
 * explicit (instead of conditionally chaining `.where()`) so the Prisma 8
 * fluent API keeps full types on every path.
 */
export async function selectCourses(db: Db, query: CourseQuery = {}): Promise<CourseRow[]> {
  const { ids, year } = query
  const courses = db.orm.public.Course

  if (ids !== undefined && ids.length === 0) return []

  if (ids !== undefined && year !== undefined) {
    const rows = await courses
      .where((course) => course.id.in(ids))
      .where((course) => course.year.eq(year))
      .orderBy((course) => course.acronym.asc())
      .all()
    return rows.map(toCourseRow)
  }

  if (ids !== undefined) {
    const rows = await courses
      .where((course) => course.id.in(ids))
      .orderBy((course) => course.acronym.asc())
      .all()
    return rows.map(toCourseRow)
  }

  if (year !== undefined) {
    const rows = await courses
      .where((course) => course.year.eq(year))
      .orderBy((course) => course.acronym.asc())
      .all()
    return rows.map(toCourseRow)
  }

  const rows = await courses.orderBy((course) => course.acronym.asc()).all()
  return rows.map(toCourseRow)
}

/**
 * Attach `faculties` to course rows: one join-table read for all rows, grouped
 * into `courseId → [acronym, ...]`. A course with no links gets `[]` rather
 * than failing — the array is part of the API contract.
 */
export async function attachFaculties(db: Db, rows: CourseRow[]): Promise<Course[]> {
  if (rows.length === 0) return []

  const links = await db.orm.public.FacultyCourse.where((link) => link.courseId.in(rows.map((row) => row.id)))
    .orderBy((link) => link.facultyId.asc())
    .all()

  // Example: Map { 22841 → ["FEUP"], 22990 → ["FCUP", "FEUP"] }
  const facultiesByCourse = new Map<number, string[]>()
  for (const link of links) {
    const faculties = facultiesByCourse.get(link.courseId)
    if (faculties) faculties.push(link.facultyId)
    else facultiesByCourse.set(link.courseId, [link.facultyId])
  }

  return rows.map((row) => ({ ...row, faculties: facultiesByCourse.get(row.id) ?? [] }))
}

/** `selectCourses` + `attachFaculties` — the common catalog list read. */
export async function loadCourses(db: Db, query: CourseQuery = {}): Promise<Course[]> {
  return attachFaculties(db, await selectCourses(db, query))
}
