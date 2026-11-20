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
  userId: string
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

/**
 * Result of a create attempt. `duplicate` means an active (non-cancelled)
 * option already covers that occurrence, discovered inside the write
 * transaction so concurrent submissions cannot both succeed.
 */
export type CreateEnrollmentRequestOutcome =
  | { kind: 'created'; request: EnrollmentRequest }
  | { kind: 'duplicate'; occurrenceId: number; occurrenceYear: number }

export type EnrollmentRequestRepository = {
  /** Every request owned by `userId`, newest first. */
  findByUserId(userId: string): Promise<EnrollmentRequest[]>

  /** A single request, or `null` when no row matches. Ownership is checked by the caller. */
  findById(id: string): Promise<EnrollmentRequest | null>

  /**
   * Creates the request and all of its options atomically, after serializing
   * submissions for the same student. The duplicate check and the insert share
   * one transaction, so two concurrent requests cannot both create an active
   * option for the same occurrence.
   */
  create(input: { userId: string; options: NewEnrollmentRequestOption[] }): Promise<CreateEnrollmentRequestOutcome>

  /**
   * Moves a `PENDING` request to `CANCELLED`. Returns `false` when the request
   * was not pending anymore (or no longer exists), so the caller can answer a
   * conflict instead of pretending the withdrawal succeeded.
   */
  withdraw(id: string): Promise<boolean>
}
