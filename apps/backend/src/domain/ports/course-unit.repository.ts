// Read-side port for the abstract course-unit catalog. Routes depend on this
// interface; the Prisma implementation lives in
// `infrastructure/database/repositories/`.
//
// A course unit is the abstract, year-agnostic template ("BD" — Bases de
// Dados). The concrete, per-year and per-course facts (classes, schedule,
// periods, admin scope) live on `Occurrence` — see `occurrence.repository.ts`.

/**
 * The two semesters a course unit can be taught in. The catalog only exposes
 * 1 or 2 — narrowing the loosely-typed database column here keeps that
 * invariant visible to every layer that consumes a `CourseUnit`.
 */
export type CourseUnitSemester = 1 | 2

/**
 * An abstract course unit. It owns no classes, periods, or enrollments — only
 * `Occurrence` rows do. `courseId` is the course that offers the unit; the
 * unit's occurrences may additionally span other courses and years.
 */
export type CourseUnit = {
  id: number
  courseId: number
  acronym: string
  name: string
  semester: CourseUnitSemester
}

/**
 * The repository contract. All methods return Promises because database
 * operations are async — they take time to complete.
 *
 *   findById(id)        → used by GET /v1/course-units/:id
 *   findByCourse(id)    → used by GET /v1/courses/:id/units
 */
export type CourseUnitRepository = {
  /** Course unit for an exact id match, or `null` if none exists (route → 404). */
  findById(id: number): Promise<CourseUnit | null>

  /** Units offered by a course, ordered by acronym. An empty list is not an error. */
  findByCourse(courseId: number): Promise<CourseUnit[]>
}
