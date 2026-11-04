export type Class = {
  id: number
  occurrenceId: number
  occurrenceYear: number
  name: string
  vacancies: number | null
  createdAt: Date
  updatedAt: Date
}

/**
 *   findById(id)                         → used by GET /v1/classes/:id
 *   findByOccurrence(occurrenceId, year) → used by GET /v1/occurrences/:id/classes
 */
export type ClassRepository = {
  /** Class for an exact id match, or `null` if none exists (route → 404). */
  findById(id: number): Promise<Class | null>

  /** Classes belonging to an occurrence's composite key `(id, year)`. */
  findByOccurrence(occurrenceId: number, occurrenceYear: number): Promise<Class[]>
}
