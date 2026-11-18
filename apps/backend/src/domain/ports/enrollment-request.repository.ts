// Read/write contract for the authenticated student's enrollment/drop
// requests. Routes and use-cases depend on this interface; the Prisma
// implementation lives in `infrastructure/database/repositories/`.

/** Lifecycle of a request. `CANCELLED` means the student withdrew it. */
export type EnrollmentRequestStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED'

/** Admin review state, mirroring `AdminValidationState` in the contract. */
export type EnrollmentRequestAdminState = 'UNTREATED' | 'TREATED' | 'REJECTED' | 'AWAITING_INFORMATION'

/**
 * One option of a request, enriched with the occurrence and course-unit data
 * the UI renders. An occurrence is the `(id, year)` pair because Sigarra reuses
 * ids across academic years.
 */
export type EnrollmentRequestOption = {
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
  /** `true` = enroll in the occurrence, `false` = drop it. */
  enrolling: boolean
}

/** A request as returned by the API, independent of transport formatting. */
export type EnrollmentRequest = {
  id: string
  status: EnrollmentRequestStatus
  adminState: EnrollmentRequestAdminState
  createdAt: Date
  updatedAt: Date
  options: EnrollmentRequestOption[]
}

/** The option shape accepted when creating a request. */
export type NewEnrollmentRequestOption = {
  occurrenceId: number
  occurrenceYear: number
  enrolling: boolean
}

export type EnrollmentRequestRepository = {
  /** Every request owned by `userId`, newest first. */
  findByUserId(userId: string): Promise<EnrollmentRequest[]>

  /** A single request, or `null` when no row matches. Ownership is checked by the caller. */
  findById(id: string): Promise<EnrollmentRequest | null>

  /** Creates the request and all of its options atomically. */
  create(input: { userId: string; options: NewEnrollmentRequestOption[] }): Promise<EnrollmentRequest>

  /**
   * Moves a `PENDING` request to `CANCELLED`. Returns `false` when the request
   * was not pending anymore (or no longer exists), so the caller can answer a
   * conflict instead of pretending the withdrawal succeeded.
   */
  withdraw(id: string): Promise<boolean>

  /**
   * Whether the student already has an option for this occurrence on a request
   * that was not cancelled. The direction (`enrolling`) is deliberately
   * ignored: one active request per occurrence is enough to reject a new one.
   */
  hasActiveOptionForOccurrence(input: {
    userId: string
    occurrenceId: number
    occurrenceYear: number
  }): Promise<boolean>
}
