type InstantLike = { epochMilliseconds: number }

export type ExchangePeriodLike = {
  occurrenceId: number
  occurrenceYear: number
  startsAt: InstantLike
  endsAt: InstantLike
}

type SelectEligibleInput<T extends { id: number; year: number }> = {
  occurrences: readonly T[]
  periods: readonly ExchangePeriodLike[]
  now: number
}

const keyOf = (id: number, year: number) => `${id}:${year}`

/**
 * Occurrences with at least one open exchange period for the same
 * `(id, year)`; start and end are both inclusive.
 * Sorted by year (newest first), then id.
 * Pure: no I/O, no clock, no mutation.
 */
export function selectEligible<T extends { id: number; year: number }>({
  occurrences,
  periods,
  now,
}: SelectEligibleInput<T>): T[] {
  const openKeys = new Set(
    periods
      .filter((period) => period.startsAt.epochMilliseconds <= now && period.endsAt.epochMilliseconds >= now)
      .map((period) => keyOf(period.occurrenceId, period.occurrenceYear)),
  )

  return occurrences
    .filter((occurrence) => openKeys.has(keyOf(occurrence.id, occurrence.year)))
    .sort((a, b) => b.year - a.year || a.id - b.id)
}
