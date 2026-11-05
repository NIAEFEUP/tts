export type Class = {
  id: number
  occurrenceId: number
  occurrenceYear: number
  name: string
  vacancies: number | null
  createdAt: Date
  updatedAt: Date
}

export type ClassProfessor = {
  id: number
  acronym: string | null
  name: string | null
}

export type ClassSlot = {
  id: number
  lessonType: string
  dayOfWeek: number
  startMinute: number
  durationMin: number
  location: string | null
  professors: ClassProfessor[]
}

export type ClassWithSlots = Class & {
  slots: ClassSlot[]
}

export type EnrolledStudent = {
  id: string
  name: string
}

/**
 *   findById(id)                         → used by GET /v1/classes/:id
 *   findByOccurrence(occurrenceId, year) → used by GET /v1/occurrences/:id/classes
 */
export type ClassRepository = {
  /** Class for an exact id match, or `null` if none exists (route → 404). */
  findById(id: number): Promise<ClassWithSlots | null>

  /** Classes belonging to an occurrence's composite key `(id, year)`. */
  findByOccurrence(occurrenceId: number, occurrenceYear: number): Promise<ClassWithSlots[]>

  /** Students enrolled in a class, or null if the class does not exist. */
  findStudentsByClassId(classId: number): Promise<EnrolledStudent[] | null>
}
