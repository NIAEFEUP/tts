// Read-side port for the course catalog. Routes depend on this interface;
// the Prisma implementation lives in `infrastructure/database/repositories/`.

/**
 * A degree offered by a faculty. `faculties` carries ALL offering faculty
 * acronyms because shared courses appear in multiple faculties.
 */
export type Course = {
  id: number
  acronym: string
  name: string
  courseType: string
  year: number
  url: string
  /** All faculties that offer this course, e.g. ["FEUP", "FCUP"]. */
  faculties: string[]
}

/** Optional filters for listing courses. Both narrow the result when given. */
export type CourseFilter = {
  year?: number
  /** only courses linked to this faculty match */
  faculty?: string
}

/**
 * The repository contract. All methods return Promises because database
 * operations are async — they take time to complete.
 *
 *   findAll(filter)  → used by GET /v1/courses?year=&faculty=
 *   findById(id)     → used by GET /v1/courses/:id
 */
export type CourseRepository = {
  /** Matching courses, ordered by acronym. An empty list is not an error. */
  findAll(filter?: CourseFilter): Promise<Course[]>

  /** Course for an exact id match, or `null` if none exists (route → 404). */
  findById(id: number): Promise<Course | null>
}
