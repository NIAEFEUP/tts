// Read-side contract for the authenticated student's current class assignments.
export type StudentEnrollment = {
  occurrence: {
    id: number
    year: number
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
}
