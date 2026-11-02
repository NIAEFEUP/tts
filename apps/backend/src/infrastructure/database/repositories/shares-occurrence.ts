/** An occurrence's real key: Sigarra reuses `id` across academic years. */
export type OccurrenceKey = { occurrenceId: number; occurrenceYear: number }

const keyOf = ({ occurrenceId, occurrenceYear }: OccurrenceKey) => `${occurrenceId}:${occurrenceYear}`

/** Whether the two lists have an occurrence, identified by `(id, year)`, in common. */
export function hasCommonOccurrence(a: OccurrenceKey[], b: OccurrenceKey[]): boolean {
  if (a.length === 0 || b.length === 0) return false

  const keys = new Set(a.map(keyOf))
  return b.some((occurrence) => keys.has(keyOf(occurrence)))
}
