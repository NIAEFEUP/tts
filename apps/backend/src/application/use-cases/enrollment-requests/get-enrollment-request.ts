import type { EnrollmentRequest, EnrollmentRequestRepository } from '@/domain/ports/enrollment-request.repository'

export type GetEnrollmentRequestResult =
  | { kind: 'ok'; request: EnrollmentRequest }
  | { kind: 'not-found' }
  | { kind: 'forbidden' }

/**
 * Loads one request and applies the owner-only rule. Keep the transport
 * mapping (404 / 403) in the route; this layer only decides the outcome.
 */
export function createGetEnrollmentRequest(deps: { enrollmentRequests: EnrollmentRequestRepository }) {
  return async function getEnrollmentRequest(userId: string, requestId: string): Promise<GetEnrollmentRequestResult> {
    const request = await deps.enrollmentRequests.findById(requestId)
    if (!request) return { kind: 'not-found' }
    if (request.userId !== userId) return { kind: 'forbidden' }

    return { kind: 'ok', request }
  }
}
