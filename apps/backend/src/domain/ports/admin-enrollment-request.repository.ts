import type { EnrollmentRequest, EnrollmentRequestAdminState } from './enrollment-request.repository'

// The admin sees who made the request, so every request carries the student name.
// The student number is already in `userId`.
export type AdminEnrollmentRequest = EnrollmentRequest & { userName: string }

export type AdminEnrollmentRequestFilters = {
  page: number
  pageSize: number
  activeCourse?: number
  activeCurricularYear?: number
  activeStates?: EnrollmentRequestAdminState[]
}

export type AdminEnrollmentRequestPage = {
  requests: AdminEnrollmentRequest[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type AdminEnrollmentRequestDecision =
  | { kind: 'ok'; request: AdminEnrollmentRequest }
  | { kind: 'not-found' }
  | { kind: 'forbidden' }
  | { kind: 'not-pending' }
  | { kind: 'occurrence-has-no-classes' }

export type AdminEnrollmentRequestRepository = {
  findForAdmin(adminUserId: string, filters: AdminEnrollmentRequestFilters): Promise<AdminEnrollmentRequestPage>
  acceptForAdmin(adminUserId: string, id: string): Promise<AdminEnrollmentRequestDecision>
  rejectForAdmin(adminUserId: string, id: string): Promise<AdminEnrollmentRequestDecision>
}
