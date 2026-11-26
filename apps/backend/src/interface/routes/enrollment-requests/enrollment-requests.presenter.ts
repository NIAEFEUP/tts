import type { AdminEnrollmentRequest } from '@/domain/ports/admin-enrollment-request.repository'
import type { EnrollmentRequest } from '@/domain/ports/enrollment-request.repository'

export type EnrollmentRequestResponse = {
  id: string
  status: EnrollmentRequest['status']
  adminState: EnrollmentRequest['adminState']
  createdAt: string
  updatedAt: string
  options: Array<{
    occurrence: EnrollmentRequest['options'][number]['occurrence']
    enrolling: boolean
  }>
}

export type AdminEnrollmentRequestResponse = EnrollmentRequestResponse & {
  userId: string
  userName: string
}

/**
 * Projects a domain request onto the public response shape: drops `userId`
 * (the list is already scoped to the caller) and turns timestamps into the ISO
 * strings JSON carries.
 */
export function toEnrollmentRequestResponse(request: EnrollmentRequest): EnrollmentRequestResponse {
  return {
    id: request.id,
    status: request.status,
    adminState: request.adminState,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    options: request.options.map((option) => ({
      occurrence: {
        id: option.occurrence.id,
        year: option.occurrence.year,
        courseUnit: {
          id: option.occurrence.courseUnit.id,
          acronym: option.occurrence.courseUnit.acronym,
          name: option.occurrence.courseUnit.name,
          semester: option.occurrence.courseUnit.semester,
        },
      },
      enrolling: option.enrolling,
    })),
  }
}

/**
 * Admin projection: same shape as the student one, plus who made the request
 * (`userId` is the student number, `userName` the student name).
 */
export function toAdminEnrollmentRequestResponse(request: AdminEnrollmentRequest): AdminEnrollmentRequestResponse {
  return {
    ...toEnrollmentRequestResponse(request),
    userId: request.userId,
    userName: request.userName,
  }
}
