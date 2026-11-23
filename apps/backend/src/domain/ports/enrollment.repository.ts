import type { ScheduleEnrollment } from './schedule-sync'

// Read/write contract for the authenticated student's current class assignments.
export type StudentEnrollment = {
  occurrence: {
    id: number
    year: number
    /** Sigarra occurrence page. */
    url: string
    courseUnit: {
      id: number
      acronym: string
      name: string
      semester: number
    }
  }
  class: {
    id: number
    name: string
    vacancies: number | null
    slots: Array<{
      id: number
      lessonType: string
      dayOfWeek: number
      startMinute: number
      durationMin: number
      location: string | null
      professors: Array<{
        id: number
        acronym: string | null
        name: string | null
      }>
    }>
  }
}

export type EnrollmentRepository = {
  findByUserId(userId: string): Promise<StudentEnrollment[]>
  /**
   * Whether both students have a class enrolled in the same occurrence, i.e.
   * the same `(id, year)` pair. A student with no enrollments shares nothing.
   */
  sharesOccurrence(userIdA: string, userIdB: string): Promise<boolean>
  /**
   * Whether the student is enrolled in any class of the `(occurrenceId,
   * occurrenceYear)` occurrence. Used to reject an enroll request for an
   * occurrence the student already holds.
   */
  isEnrolledInOccurrence(userId: string, occurrenceId: number, occurrenceYear: number): Promise<boolean>
  /** Replaces all enrollment rows for userId with the supplied authoritative list. */
  replaceForUser?(userId: string, enrollments: ScheduleEnrollment[]): Promise<void>
}
