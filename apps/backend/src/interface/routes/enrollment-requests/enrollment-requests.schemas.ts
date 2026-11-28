import { t, type TSchema } from 'elysia'

import type { EnrollmentRequestAdminState, EnrollmentRequestStatus } from '@/domain/ports/enrollment-request.repository'

// Wire schemas for `/v1/enrollment-requests`. Status and admin-state unions are
// declared with `satisfies Record<..., TSchema>` so a value added to the domain
// without a matching wire schema becomes a compile error.

const STATUS = {
  PENDING: t.Literal('PENDING'),
  ACCEPTED: t.Literal('ACCEPTED'),
  CANCELLED: t.Literal('CANCELLED'),
} satisfies Record<EnrollmentRequestStatus, TSchema>

const ADMIN_STATE = {
  UNTREATED: t.Literal('UNTREATED'),
  TREATED: t.Literal('TREATED'),
  REJECTED: t.Literal('REJECTED'),
  AWAITING_INFORMATION: t.Literal('AWAITING_INFORMATION'),
} satisfies Record<EnrollmentRequestAdminState, TSchema>

export const enrollmentRequestStatusSchema = t.Union([STATUS.PENDING, STATUS.ACCEPTED, STATUS.CANCELLED])

export const enrollmentRequestAdminStateSchema = t.Union([
  ADMIN_STATE.UNTREATED,
  ADMIN_STATE.TREATED,
  ADMIN_STATE.REJECTED,
  ADMIN_STATE.AWAITING_INFORMATION,
])

/** One option, with the occurrence and course-unit data the UI renders. */
export const enrollmentRequestOptionSchema = t.Object({
  occurrence: t.Object({
    id: t.Integer(),
    year: t.Integer(),
    courseUnit: t.Object({
      id: t.Integer(),
      acronym: t.String(),
      name: t.String(),
      semester: t.Number(),
    }),
  }),
  enrolling: t.Boolean(),
})

/** A request as list, create and detail responses expose it. */
export const enrollmentRequestSchema = t.Object({
  id: t.String(),
  status: enrollmentRequestStatusSchema,
  adminState: enrollmentRequestAdminStateSchema,
  // ISO strings, not t.Date(): JSON carries strings and t.Date() would make
  // Eden type them as Date objects.
  createdAt: t.String({ format: 'date-time' }),
  updatedAt: t.String({ format: 'date-time' }),
  options: t.Array(enrollmentRequestOptionSchema),
})

/**
 * A request as the admin endpoints expose it: the student request plus who made
 * it. `userId` is the student number.
 */
export const adminEnrollmentRequestSchema = t.Object({
  ...enrollmentRequestSchema.properties,
  userId: t.String(),
  userName: t.String(),
})

/** Body of `POST /v1/enrollment-requests`. Between 1 and 20 options. */
export const createEnrollmentRequestSchema = t.Object({
  options: t.Array(
    t.Object({
      // Occurrence.id is a PostgreSQL `integer`; larger values would fail in
      // the database instead of the schema.
      occurrenceId: t.Integer({ maximum: 2147483647 }),
      occurrenceYear: t.Integer(),
      enrolling: t.Boolean(),
    }),
    { minItems: 1, maxItems: 20 },
  ),
})
