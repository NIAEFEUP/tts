// Read-side port for exchange periods. Routes depend on this interface;
// the Prisma implementation lives in `infrastructure/database/repositories/`.

/** A date range during which an exchange occurrence is open. */
export type ExchangePeriod = {
  occurrenceId: number
  occurrenceYear: number
  startsAt: Date
  endsAt: Date
}

/**
 * The repository contract.
 * Periods of the given occurrence, ordered by `startAt`.
 */
export type ExchangePeriodsRepository = {
  findByOccurrence(occurrenceId: number, occurrenceYear: number): Promise<ExchangePeriod[]>
}
