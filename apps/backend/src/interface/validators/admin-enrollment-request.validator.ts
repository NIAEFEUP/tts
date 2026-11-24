import { t } from 'elysia'

export const adminStateSchema = t.Union([
  t.Literal('UNTREATED'),
  t.Literal('TREATED'),
  t.Literal('REJECTED'),
  t.Literal('AWAITING_INFORMATION'),
])

export const adminEnrollmentRequestQuerySchema = t.Object({
  page: t.Optional(t.Integer({ minimum: 1, default: 1 })),
  page_size: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
  activeCourse: t.Optional(t.Integer()),
  activeCurricularYear: t.Optional(t.Integer()),
  activeStates: t.Optional(t.String()),
})

export const adminEnrollmentRequestParamsSchema = t.Object({
  id: t.String({ minLength: 1 }),
})
