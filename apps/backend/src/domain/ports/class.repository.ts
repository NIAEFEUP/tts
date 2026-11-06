/** Class data required by the class detail and occurrence classes endpoints. */
export type Class = {
  id: number
  occurrenceId: number
  occurrenceYear: number
  name: string
  vacancies: number | null
}

/**
 * A professor assigned to a schedule slot. Sigarra may omit either
 * descriptive field, so both remain nullable.
 */
export type ClassProfessor = {
  id: number
  acronym: string | null
  name: string | null
}

/** A schedule slot attached to a class. Times are stored in minutes. */
export type ClassSlot = {
  id: number
  lessonType: string
  dayOfWeek: number
  startMinute: number
  durationMin: number
  location: string | null
  professors: ClassProfessor[]
}

/** A class with its schedule slots and the professors assigned to them. */
export type ClassWithSlots = Class & {
  slots: ClassSlot[]
}

/** A student enrolled in a class. */
export type EnrolledStudent = {
  id: string
  name: string
}

/**
 * Read-side contract for classes, their schedule, and class enrollments.
 * The occurrence lookup uses both ID and year because occurrence IDs are
 * only unique within an academic year.
 *
 *   findById(id)                         → used by GET /v1/classes/:id
 *   findByOccurrence(occurrenceId, year) → used by GET /v1/occurrences/:id/classes
 *   findStudentsByClassId(classId)       → used by GET /v1/classes/:id/students
 */

export type ClassRepository = {
  /** A single class with its slots and professors, or `null` if it does not exist. */
  findById(id: number): Promise<ClassWithSlots | null>

  /** Classes belonging to an occurrence, with their slots and professors. */
  findByOccurrence(occurrenceId: number, occurrenceYear: number): Promise<ClassWithSlots[]>

  /**
   * Students enrolled in a class, or `null` if the class does not exist.
   * An existing class with no enrollments returns an empty array.
   */
  findStudentsByClassId(classId: number): Promise<EnrolledStudent[] | null>
}
