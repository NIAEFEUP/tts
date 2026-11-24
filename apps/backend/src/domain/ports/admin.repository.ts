import type { Course } from './course.repository'
import type { OccurrenceWithUnit } from './occurrence.repository'

/**
 * The repository contract. An empty list is not an error: it means the
 * admin has no scope.
 *
 *   findCoursesByAdmin(userId)      → used by GET /v1/admin/courses
 *   findOccurrencesByAdmin(userId)  → used by GET /v1/admin/occurrences
 */
export type AdminRepository = {
  // Courses in the admin's `AdminCourse` scope. Ordered by acronym.
  findCoursesByAdmin(userId: string): Promise<Course[]>

  /**
   * Occurrences in the admin's `AdminOccurrence` scope, with the course
   * unit's `acronym` and `name`. Ordered by year (newest first), then id.
   * The join uses both `id` and `year`, since Sigarra reuses ids across years.
   */
  findOccurrencesByAdmin(userId: string): Promise<OccurrenceWithUnit[]>

  /** Whether the user has an `AdminCourse` row for this course. */
  hasCourseScope(userId: string, courseId: number): Promise<boolean>

  /**
   * Whether the user has an `AdminOccurrence` row for this occurrence.
   */
  hasOccurrenceScope(userId: string, occurrenceId: number, occurrenceYear: number): Promise<boolean>
}
