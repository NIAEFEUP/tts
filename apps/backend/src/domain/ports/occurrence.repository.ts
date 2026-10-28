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
 * The repository contract. All methods return Promises because database
 * operations are async — they take time to complete.
 *
 *   findByCourseUnit(id)  → used by GET /v1/course-units/:id/occurrences
 */
export type OccurrenceRepository = {
  /**
   * Every occurrence of a course unit, across courses and academic years.
   * Ordered by year (newest first). An empty list is not an error.
   */
  findByCourseUnit(courseUnitId: number): Promise<Occurrence[]>
}
