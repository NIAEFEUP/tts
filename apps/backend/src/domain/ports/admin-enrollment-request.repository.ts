import type { EnrollmentRequest } from './enrollment-request.repository'

export type AdminEnrollmentRequestFilters = {
  page: number
  pageSize: number
  activeCourse?: number
  activeCurricularYear?: number
  activeStates?: string[]
}

export type AdminEnrollmentRequestPage = {
  requests: EnrollmentRequest[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type AdminEnrollmentRequestDecision =
  | { kind: 'ok'; request: EnrollmentRequest }
  | { kind: 'not-found' }
  | { kind: 'forbidden' }
  | { kind: 'not-pending' }

export type AdminEnrollmentRequestRepository = {
  findForAdmin(adminUserId: string, filters: AdminEnrollmentRequestFilters): Promise<AdminEnrollmentRequestPage>
  acceptForAdmin(adminUserId: string, id: string): Promise<AdminEnrollmentRequestDecision>
  rejectForAdmin(adminUserId: string, id: string): Promise<AdminEnrollmentRequestDecision>
}
