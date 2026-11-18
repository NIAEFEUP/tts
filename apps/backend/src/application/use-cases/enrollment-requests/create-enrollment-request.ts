import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import type {
  EnrollmentRequest,
  EnrollmentRequestRepository,
  NewEnrollmentRequestOption,
} from '@/domain/ports/enrollment-request.repository'
import type { ExchangePeriodsRepository } from '@/domain/ports/exchange-period.repository'
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'

/** Why a request was rejected before anything was written. */
export type CreateEnrollmentRequestFailure =
  | { kind: 'duplicate-option'; occurrenceId: number; occurrenceYear: number }
  | { kind: 'occurrence-not-found'; occurrenceId: number; occurrenceYear: number }
  | { kind: 'exchange-period-closed'; occurrenceId: number; occurrenceYear: number }
  | { kind: 'duplicate-request'; occurrenceId: number; occurrenceYear: number }
  | { kind: 'already-enrolled'; occurrenceId: number; occurrenceYear: number }

export type CreateEnrollmentRequestResult = { kind: 'ok'; request: EnrollmentRequest } | CreateEnrollmentRequestFailure

/**
 * Creation rules, all checked before the first write:
 *
 * - an option cannot repeat an occurrence inside the same payload;
 * - the occurrence must exist for the given `(id, year)` pair;
 * - at least one exchange period of that occurrence must be open now;
 * - the student cannot already have a non-cancelled option for it;
 * - an `enroll` option cannot target an occurrence the student already holds.
 *
 * A `drop` option does not require an existing enrollment, matching the
 * legacy Django behavior.
 */
export function createCreateEnrollmentRequest(deps: {
  enrollmentRequests: EnrollmentRequestRepository
  enrollments: EnrollmentRepository
  occurrences: OccurrenceRepository
  periods: ExchangePeriodsRepository
  /** Clock override for tests; defaults to the real time. */
  now?: () => number
}) {
  const now = deps.now ?? (() => Date.now())

  return async function createEnrollmentRequest(
    userId: string,
    options: NewEnrollmentRequestOption[],
  ): Promise<CreateEnrollmentRequestResult> {
    // Natural key of an option. Catching it here keeps the database's
    // per-request unique constraint from surfacing as a 500.
    const seen = new Set<string>()
    for (const option of options) {
      const key = `${option.occurrenceId}:${option.occurrenceYear}`
      if (seen.has(key)) {
        return {
          kind: 'duplicate-option',
          occurrenceId: option.occurrenceId,
          occurrenceYear: option.occurrenceYear,
        }
      }
      seen.add(key)
    }

    const currentTime = now()

    for (const option of options) {
      const { occurrenceId, occurrenceYear, enrolling } = option

      const occurrence = await deps.occurrences.findById(occurrenceId, occurrenceYear)
      if (!occurrence) return { kind: 'occurrence-not-found', occurrenceId, occurrenceYear }

      const periods = await deps.periods.findByOccurrence(occurrenceId, occurrenceYear)
      const isOpen = periods.some(
        (period) => period.startsAt.getTime() <= currentTime && period.endsAt.getTime() >= currentTime,
      )
      if (!isOpen) return { kind: 'exchange-period-closed', occurrenceId, occurrenceYear }

      const hasDuplicate = await deps.enrollmentRequests.hasActiveOptionForOccurrence({
        userId,
        occurrenceId,
        occurrenceYear,
      })
      if (hasDuplicate) return { kind: 'duplicate-request', occurrenceId, occurrenceYear }

      if (enrolling && (await deps.enrollments.isEnrolledInOccurrence(userId, occurrenceId, occurrenceYear))) {
        return { kind: 'already-enrolled', occurrenceId, occurrenceYear }
      }
    }

    return { kind: 'ok', request: await deps.enrollmentRequests.create({ userId, options }) }
  }
}
