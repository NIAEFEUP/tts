import { Elysia, t } from 'elysia'

import type { ExchangeCycle, ExchangeRepository, ExchangeRequest } from '@/domain/ports/exchange.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { httpError } from '@/interface/errors/errors'

const exchangeItemSchema = t.Object({
  userId: t.String(),
  occurrenceId: t.Number(),
  occurrenceYear: t.Number(),
  fromClassId: t.Number(),
  toClassId: t.Number(),
  status: t.Union([t.Literal('PENDING'), t.Literal('ACCEPTED'), t.Literal('CANCELLED'), t.Literal('INVALID')]),
  acceptedAt: t.Union([t.String({ format: 'date-time' }), t.Null()]),
})

const exchangeCycleSchema = t.Object({
  id: t.String(),
  status: t.Union([t.Literal('PENDING'), t.Literal('ACCEPTED'), t.Literal('CANCELLED')]),
  adminState: t.Union([
    t.Literal('UNTREATED'),
    t.Literal('TREATED'),
    t.Literal('REJECTED'),
    t.Literal('AWAITING_INFORMATION'),
  ]),
  origin: t.Union([t.Literal('DIRECT'), t.Literal('MARKETPLACE'), t.Literal('URGENT'), t.Literal('AUTO_MATCH')]),
  // ISO strings, not t.Date(): JSON carries strings and t.Date() would make
  // Eden type them as Date objects.
  createdAt: t.String({ format: 'date-time' }),
  updatedAt: t.String({ format: 'date-time' }),
  items: t.Array(exchangeItemSchema),
})

const exchangeRequestSchema = t.Object({
  id: t.String(),
  creatorId: t.String(),
  targetUserId: t.Union([t.String(), t.Null()]),
  type: t.Union([t.Literal('DIRECT'), t.Literal('MARKETPLACE'), t.Literal('URGENT')]),
  // The offer lifecycle, not the legacy PENDING/ACCEPTED request status: those
  // moved to the cycle when exchange requests became offers (#966).
  status: t.Union([t.Literal('OPEN'), t.Literal('MATCHED'), t.Literal('CANCELLED'), t.Literal('EXPIRED')]),
  message: t.Union([t.String(), t.Null()]),
  occurrenceId: t.Number(),
  occurrenceYear: t.Number(),
  fromClassId: t.Number(),
  toClassId: t.Number(),
  createdAt: t.String({ format: 'date-time' }),
  updatedAt: t.String({ format: 'date-time' }),
  // Null while the offer is unclaimed: no cycle, no items.
  cycle: t.Union([exchangeCycleSchema, t.Null()]),
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

function serializeCycle(cycle: ExchangeCycle) {
  return {
    ...cycle,
    createdAt: cycle.createdAt.toISOString(),
    updatedAt: cycle.updatedAt.toISOString(),
    items: cycle.items.map((item) => ({
      ...item,
      acceptedAt: item.acceptedAt?.toISOString() ?? null,
    })),
  }
}

function serializeExchange(exchange: ExchangeRequest) {
  return {
    ...exchange,
    createdAt: exchange.createdAt.toISOString(),
    updatedAt: exchange.updatedAt.toISOString(),
    cycle: exchange.cycle ? serializeCycle(exchange.cycle) : null,
  }
}

export const exchangeRoutes = (sessions: SessionRepository) =>
  new Elysia<'/v1/users/me', ExchangeRoutesDeps>({ prefix: '/v1/users/me' })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .model({ ApiError: apiError })
    .get(
      '/exchanges',
      async ({ user, query, repositories }) => {
        if (!user) throw httpError.unauthorized()

        const result = await repositories.exchangeRepository.findForUser(user.id, {
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
          data: result.data.map(serializeExchange),
        }
      },
      {
        query: t.Object({
          role: t.Optional(t.Union([t.Literal('sent'), t.Literal('received'), t.Literal('all')])),
          status: t.Optional(
            t.Union([t.Literal('OPEN'), t.Literal('MATCHED'), t.Literal('CANCELLED'), t.Literal('EXPIRED')]),
          ),
          type: t.Optional(t.Union([t.Literal('DIRECT'), t.Literal('MARKETPLACE'), t.Literal('URGENT')])),
          page: t.Optional(t.Integer({ minimum: 1, default: 1 })),
          limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 10 })),
        }),
        response: { 200: exchangePageSchema, 401: 'ApiError' },
        detail: { tags: ['users'], summary: 'List my exchange requests' },
      },
    )
