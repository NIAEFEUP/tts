import type { EnrollmentRequestRepository } from '@/domain/ports/enrollment-request.repository'
import { createGetEnrollmentRequest } from './get-enrollment-request'

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
  const getEnrollmentRequest = createGetEnrollmentRequest(deps)

  return async function withdrawEnrollmentRequest(
    userId: string,
    requestId: string,
  ): Promise<WithdrawEnrollmentRequestResult> {
    const found = await getEnrollmentRequest(userId, requestId)
    if (found.kind !== 'ok') return found
    if (found.request.status !== 'PENDING') return { kind: 'not-pending' }

    // Conditional at the repository level too: if the request stopped being
    // PENDING between the read and the write, the withdrawal changed nothing.
    const withdrawn = await deps.enrollmentRequests.withdraw(requestId)
    return withdrawn ? { kind: 'ok' } : { kind: 'not-pending' }
  }
}
