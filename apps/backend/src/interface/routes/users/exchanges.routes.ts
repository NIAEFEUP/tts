import { Elysia, t } from 'elysia'

import type { ExchangeRepository } from '@/domain/ports/exchange.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'

const exchangeItemSchema = t.Object({
  userId: t.String(),
  occurrenceId: t.Number(),
  occurrenceYear: t.Number(),
  fromClassId: t.Number(),
  toClassId: t.Number(),
  accepted: t.Boolean(),
})

const exchangeRequestSchema = t.Object({
  id: t.String(),
  creatorId: t.String(),
  targetUserId: t.Union([t.String(), t.Null()]),
  type: t.Union([t.Literal('DIRECT'), t.Literal('MARKETPLACE'), t.Literal('URGENT')]),
  status: t.Union([t.Literal('PENDING'), t.Literal('ACCEPTED'), t.Literal('CANCELLED')]),
  message: t.Union([t.String(), t.Null()]),
  adminState: t.Union([
    t.Literal('UNTREATED'),
    t.Literal('TREATED'),
    t.Literal('REJECTED'),
    t.Literal('AWAITING_INFORMATION'),
  ]),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  items: t.Array(exchangeItemSchema),
})

const exchangePageSchema = t.Object({
  page: t.Object({
    current: t.Number(),
    has_next: t.Boolean(),
    has_previous: t.Boolean(),
  }),
  data: t.Array(exchangeRequestSchema),
})

type ExchangeRoutesDeps = {
  decorator: { repositories: { exchangeRepository: ExchangeRepository } }
  store: {}
  derive: {}
  resolve: {}
}

export const exchangeRoutes = (sessions: SessionRepository) =>
  new Elysia<'/v1/users/me', ExchangeRoutesDeps>({ prefix: '/v1/users/me' })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .model({ ApiError: apiError })
    .get(
      '/exchanges',
      async ({ user, query, repositories }) => {
        const result = await repositories.exchangeRepository.findForUser(user!.id, {
          role: query.role ?? 'all',
          status: query.status,
          type: query.type,
          page: query.page ?? 1,
          limit: query.limit ?? 10,
        })
        return {
          page: {
            current: result.current,
            has_next: result.hasNext,
            has_previous: result.hasPrevious,
          },
          data: result.data,
        }
      },
      {
        query: t.Object({
          role: t.Optional(t.Union([t.Literal('sent'), t.Literal('received'), t.Literal('all')])),
          status: t.Optional(t.Union([t.Literal('PENDING'), t.Literal('ACCEPTED'), t.Literal('CANCELLED')])),
          type: t.Optional(t.Union([t.Literal('DIRECT'), t.Literal('MARKETPLACE'), t.Literal('URGENT')])),
          page: t.Optional(t.Integer({ minimum: 1, default: 1 })),
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 10 })),
        }),
        response: { 200: exchangePageSchema, 401: 'ApiError' },
        detail: { tags: ['users'], summary: 'List my exchange requests' },
      },
    )
