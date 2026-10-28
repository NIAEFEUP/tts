// Read-side port for the faculty catalog. Routes depend on this interface;
// the Prisma implementation lives in `infrastructure/database/repositories/`.
//
// A "port" is an interface that defines *what* operations are possible without
// saying *how* they're done. Think of it like a power outlet standard: it defines
// the shape of the plug, but doesn't care what's behind the wall.

import type { Course } from '@/domain/ports/course.repository'

/** A faculty identified by its Sigarra acronym. `name` is optional (null). */
export type Faculty = {
  acronym: string
  name: string | null
}

/**
 * The repository contract. All methods return Promises because database
 * operations are async — they take time to complete.
 *
 *   findAll()                  → used by GET /v1/faculties/
 *   findByAcronym(acronym)     → used by GET /v1/faculties/:acronym
 *   findCoursesByFaculty(...)  → used by GET /v1/faculties/:acronym/courses
 */
export type FacultyRepository = {
  /** Every faculty, ordered by acronym. */
  findAll(): Promise<Faculty[]>

  /** Faculty for an exact acronym match, or `null` if none exists. */
  findByAcronym(acronym: string): Promise<Faculty | null>

  /** Courses offered by a faculty. `year` filters to one academic year when given. */
  findCoursesByFaculty(acronym: string, year?: number): Promise<Course[]>
}
