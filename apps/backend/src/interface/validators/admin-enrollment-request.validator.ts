import { t } from 'elysia'

import type { EnrollmentRequestAdminState } from '@/domain/ports/enrollment-request.repository'
import { HttpError } from '@/interface/errors/errors'

export const adminStateSchema = t.Union([
  t.Literal('UNTREATED'),
  t.Literal('TREATED'),
  t.Literal('REJECTED'),
  t.Literal('AWAITING_INFORMATION'),
])

// The valid admin states come from the union above, so there is one list. The
// annotation makes the compiler check each literal against the domain union.
const ADMIN_STATES: readonly EnrollmentRequestAdminState[] = adminStateSchema.anyOf.map((literal) => literal.const)

function isAdminState(value: string): value is EnrollmentRequestAdminState {
  return (ADMIN_STATES as readonly string[]).includes(value)
}

/**
 * Parses the comma-separated `activeStates` query value. The case does not
 * matter, so `untreated` works like `UNTREATED`. Unknown values answer 400
 * instead of silently matching nothing (e.g. `?activeStates=PENDNG`).
 */
export function parseActiveStates(raw: string | undefined): EnrollmentRequestAdminState[] | undefined {
  if (raw === undefined) return undefined

  const values = raw
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0)
  if (values.length === 0) return undefined

  const invalid = values.filter((value) => !isAdminState(value))
  if (invalid.length > 0) {
    throw new HttpError(
      'invalid-active-states',
      `Invalid activeStates: ${invalid.join(', ')}. Allowed: ${ADMIN_STATES.join(', ')}`,
      400,
    )
  }

  return values as EnrollmentRequestAdminState[]
}

export const adminEnrollmentRequestQuerySchema = t.Object({
  page: t.Optional(t.Integer({ minimum: 1, default: 1 })),
  page_size: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
  activeCourse: t.Optional(t.Integer()),
  activeCurricularYear: t.Optional(t.Integer()),
  // Comma-separated list of admin states; validated by `parseActiveStates`.
  activeStates: t.Optional(t.String()),
})

export const adminEnrollmentRequestParamsSchema = t.Object({
  id: t.String({ minLength: 1 }),
})
