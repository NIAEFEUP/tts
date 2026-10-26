// Read-side port for a student's class schedule, built from their enrollments.

/** One lesson. `dayOfWeek` is 0-based from Sunday; times are minutes since midnight. */
export type ScheduleSlot = {
  id: number
  lessonType: string
  dayOfWeek: number
  startMinute: number
  durationMin: number
  location: string | null
}

/** A class the student is enrolled in, with the lessons it holds. */
export type ScheduledClass = {
  classId: number
  className: string
  occurrenceId: number
  occurrenceYear: number
  courseUnit: { acronym: string; name: string }
  slots: ScheduleSlot[]
}

export type ScheduleRepository = {
  /** Every class the student is enrolled in, with its lessons. Empty if none. */
  findByStudent(nmec: string): Promise<ScheduledClass[]>

  /**
   * Whether both students are enrolled in at least one class belonging to the
   * same `Course` (the degree). This is what makes someone a "participant" who
   * may see the other's schedule.
   */
  sharesCourse(nmecA: string, nmecB: string): Promise<boolean>
}
