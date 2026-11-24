// Read-side port for exchange periods. Routes depend on this interface;
// the Prisma implementation lives in `infrastructure/database/repositories/`.

/** A date range during which an exchange occurrence is open. */
export type ExchangePeriod = {
  /** Surrogate key: the admin UI edits and deletes a period by id. */
  id: string
  occurrenceId: number
  occurrenceYear: number
  startsAt: Date
  endsAt: Date
}

/** A window during which a course is open for exchanges,
 * shared by its occurrences. */
export type CourseExchangePeriod = Pick<ExchangePeriod, 'id' | 'startsAt' | 'endsAt'>

export type NewExchangePeriod = {
  occurrenceId: number
  occurrenceYear: number
  startsAt: Date
  endsAt: Date
}

export type ExchangePeriodWriteResult =
  | { kind: 'created'; period: ExchangePeriod }
  | { kind: 'updated'; period: ExchangePeriod }
  | { kind: 'deleted'; period: ExchangePeriod }
  | { kind: 'overlap' }
  | { kind: 'not-found' }
  | { kind: 'pending-requests' }

export type CourseExchangePeriodsWriteResult =
  | { kind: 'created'; periods: ExchangePeriod[] }
  | { kind: 'overlap'; occurrenceId: number; occurrenceYear: number }

/* The repository contract.*/
export type ExchangePeriodsRepository = {
  /** Period with the given surrogate id, or `null` if none exists. */
  findById(id: string): Promise<ExchangePeriod | null>

  /** Periods of the given occurrence, ordered by `startsAt`. */
  findByOccurrence(occurrenceId: number, occurrenceYear: number): Promise<ExchangePeriod[]>

  /** Distinct windows across all occurrences of the course, ordered by `startsAt`. */
  findByCourse(courseId: number): Promise<CourseExchangePeriod[]>

  /**
   * Creates a period if it does not overlap another period for this occurrence.
   */
  create(input: NewExchangePeriod): Promise<ExchangePeriodWriteResult>

  /**
   * Updates a period only when its id belongs to the supplied occurrence pair.
   * Returns `overlap` if the new range conflicts with another period there.
   */
  update(input: {
    id: string
    occurrenceId: number
    occurrenceYear: number
    startsAt: Date
    endsAt: Date
  }): Promise<ExchangePeriodWriteResult>

  /**
   * Deletes a period, but reports `pending-requests` rather than removing it
   * when pending requests depend on it.
   */
  delete(input: { id: string; occurrenceId: number; occurrenceYear: number }): Promise<ExchangePeriodWriteResult>

  /**
   * Creates the same window for every occurrence of a course.
   * The overlap check and all inserts must run in one transaction.
   */
  createForCourse(input: { courseId: number; startsAt: Date; endsAt: Date }): Promise<CourseExchangePeriodsWriteResult>
}
