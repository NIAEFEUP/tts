import type { EnrollmentRequestRepository } from '@/domain/ports/enrollment-request.repository'

export type WithdrawEnrollmentRequestResult =
  | { kind: 'ok' }
  | { kind: 'not-found' }
  | { kind: 'forbidden' }
  | { kind: 'not-pending' }

/**
 * Withdraws a request by moving it to `CANCELLED`. Unknown ids are
 * `not-found`, someone else's request is `forbidden`, and only a `PENDING`
 * request can be withdrawn.
 */
export function createWithdrawEnrollmentRequest(deps: { enrollmentRequests: EnrollmentRequestRepository }) {
  return async function withdrawEnrollmentRequest(
    userId: string,
    requestId: string,
  ): Promise<WithdrawEnrollmentRequestResult> {
    const request = await deps.enrollmentRequests.findById(requestId)
    if (!request) return { kind: 'not-found' }
    if (request.userId !== userId) return { kind: 'forbidden' }
    if (request.status !== 'PENDING') return { kind: 'not-pending' }

    // Conditional at the repository level too: if the request stopped being
    // PENDING between the read and the write, the withdrawal changed nothing.
    const withdrawn = await deps.enrollmentRequests.withdraw(requestId)
    return withdrawn ? { kind: 'ok' } : { kind: 'not-pending' }
  }
}
