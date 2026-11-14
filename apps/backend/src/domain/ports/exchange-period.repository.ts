// Read-side port for exchange periods. Routes depend on this interface;
// the Prisma implementation lives in `infrastructure/database/repositories/`.

/** A date range during which an exchange occurrence is open. */
export type ExchangePeriod = {
  occurrenceId: number
  occurrenceYear: number
  startsAt: Date
  endsAt: Date
}

/** A window during which a course is open for exchanges,
 * shared by its occurrences. */
export type CourseExchangePeriod = Pick<ExchangePeriod, 'startsAt' | 'endsAt'>

/* The repository contract.*/
export type ExchangePeriodsRepository = {
  /**  Periods of the given occurrence, ordered by `startAt`. */
  findByOccurrence(occurrenceId: number, occurrenceYear: number): Promise<ExchangePeriod[]>
  /** Distinct windows across all occurrences of the course, ordered by `startsAt`. */
  findByCourse(courseId: number): Promise<CourseExchangePeriod[]>
}
