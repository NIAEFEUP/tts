// Read-side port for occurrences — the concrete instances of an abstract
// course unit. Routes depend on this interface; the Prisma implementation
// lives in `infrastructure/database/repositories/`.
//
// An occurrence is the (course unit, course, academic year) tuple: the place
// where a course unit is actually taught. It owns the classes, schedule,
// exchange periods, and admin scope that the abstract `CourseUnit` does not.

/**
 * A concrete offering of a course unit. `id` is the Sigarra occurrence id and
 * is only unique per academic year — the row's real key is `(id, year)`.
 */
export type Occurrence = {
  id: number
  courseUnitId: number
  courseId: number
  year: number
  ects: number
  url: string
  hash: string
}

/**
 * An occurrence joined with the fields of its abstract course unit. Returned
 * by `findById` so the single-occurrence endpoint can include the unit's
 * human-readable name and acronym without a separate round-trip.
 */
export type OccurrenceWithUnit = Occurrence & {
  acronym: string
  name: string
}

/**
 * Optional filters for listing occurrences of a course. Both narrow the
 * result when provided; omitting either returns occurrences for all values of
 * that dimension.
 */
export type OccurrenceFilter = {
  year?: number
  /** 1 = first semester, 2 = second semester */
  /** Which semester to keep — same union as `CourseUnit.semester`. */
  semester?: CourseUnitSemester
}

/**
 * The repository contract. All methods return Promises because database
 * operations are async — they take time to complete.
 *
 *   findByCourseUnit(id)            → used by GET /v1/course-units/:id/occurrences
 *   findByCourse(courseId, filter)  → used by GET /v1/courses/:id/occurrences
 *   findById(id, year)              → used by GET /v1/occurrences/:id
 */
export type OccurrenceRepository = {
  /**
   * Every occurrence of a course unit, across courses and academic years.
   * Ordered by year (newest first). An empty list is not an error.
   */
  findByCourseUnit(courseUnitId: number): Promise<Occurrence[]>

  /**
   * Occurrences for a course, optionally narrowed by academic year and/or
   * semester. Ordered by year (newest first). An empty list is not an error.
   */
  findByCourse(courseId: number, filter?: OccurrenceFilter): Promise<Occurrence[]>

  /**
   * Single occurrence looked up by its composite primary key `(id, year)`.
   * Returns `null` when no row matches — the route turns this into a 404.
   * The result includes the course unit's `acronym` and `name` so the
   * endpoint can return the enriched shape without a separate query.
   */
  findById(id: number, year: number): Promise<OccurrenceWithUnit | null>
}
