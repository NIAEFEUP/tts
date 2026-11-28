import { describe, expect, it } from 'bun:test'

import type { ExchangeRequest, ExchangeRequestPage } from '@/domain/ports/exchange.repository'
import { mapExchangeRequest } from '@/infrastructure/database/repositories/prisma-exchange.repository'

import { TEST_USER } from '../support/auth-test-utils'
import { UNAUTHORIZED_BODY, VALIDATION_ERROR_BODY } from '../support/catalog-test-utils'
import { createUsersApp } from '../support/user-test-utils'

const matchedRequest: ExchangeRequest = {
  id: 'request-1',
  creatorId: TEST_USER.id,
  targetUserId: '202399999',
  type: 'DIRECT',
  status: 'MATCHED',
  message: null,
  occurrenceId: 587177,
  occurrenceYear: 2025,
  fromClassId: 456,
  toClassId: 457,
  createdAt: new Date('2025-01-02T00:00:00.000Z'),
  updatedAt: new Date('2025-01-02T00:00:00.000Z'),
  cycle: {
    id: 'cycle-1',
    status: 'PENDING',
    adminState: 'UNTREATED',
    origin: 'DIRECT',
    createdAt: new Date('2025-01-02T00:00:00.000Z'),
    updatedAt: new Date('2025-01-03T00:00:00.000Z'),
    items: [
      {
        userId: TEST_USER.id,
        occurrenceId: 587177,
        occurrenceYear: 2025,
        fromClassId: 456,
        toClassId: 457,
        status: 'PENDING',
        acceptedAt: null,
      },
      {
        userId: '202399999',
        occurrenceId: 587177,
        occurrenceYear: 2025,
        fromClassId: 457,
        toClassId: 456,
        status: 'ACCEPTED',
        acceptedAt: new Date('2025-01-03T00:00:00.000Z'),
      },
    ],
  },
}

const openRequest: ExchangeRequest = {
  ...matchedRequest,
  id: 'request-2',
  targetUserId: null,
  type: 'MARKETPLACE',
  status: 'OPEN',
  cycle: null,
}

const page: ExchangeRequestPage = {
  current: 2,
  hasNext: true,
  hasPrevious: true,
  data: [matchedRequest],
}

function serialize(request: ExchangeRequest) {
  return {
    ...request,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    cycle: request.cycle
      ? {
          ...request.cycle,
          createdAt: request.cycle.createdAt.toISOString(),
          updatedAt: request.cycle.updatedAt.toISOString(),
          items: request.cycle.items.map((item) => ({
            ...item,
            acceptedAt: item.acceptedAt?.toISOString() ?? null,
          })),
        }
      : null,
  }
}

describe('exchange routes', () => {
  it('maps Prisma timestamps on the offer, the cycle and its items to Date objects', () => {
    const createdAt = Date.parse('2025-01-02T00:00:00.000Z')
    const cycleCreatedAt = Date.parse('2025-01-03T00:00:00.000Z')
    const acceptedAt = Date.parse('2025-01-04T00:00:00.000Z')

    const mapped = mapExchangeRequest({
      ...openRequest,
      createdAt: { epochMilliseconds: createdAt },
      updatedAt: { epochMilliseconds: createdAt },
      cycles: [
        {
          cycle: {
            id: 'cycle-1',
            status: 'ACCEPTED',
            adminState: 'TREATED',
            origin: 'DIRECT',
            createdAt: { epochMilliseconds: cycleCreatedAt },
            updatedAt: { epochMilliseconds: cycleCreatedAt },
            items: [
              {
                userId: TEST_USER.id,
                occurrenceId: 587177,
                occurrenceYear: 2025,
                fromClassId: 456,
                toClassId: 457,
                status: 'ACCEPTED',
                acceptedAt: { epochMilliseconds: acceptedAt },
              },
              {
                userId: '202399999',
                occurrenceId: 587177,
                occurrenceYear: 2025,
                fromClassId: 457,
                toClassId: 456,
                status: 'PENDING',
                acceptedAt: null,
              },
            ],
          },
        },
      ],
    })

    expect(mapped.createdAt).toEqual(new Date(createdAt))
    expect(mapped.updatedAt).toEqual(new Date(createdAt))
    expect(mapped.cycle?.createdAt).toEqual(new Date(cycleCreatedAt))
    expect(mapped.cycle?.updatedAt).toEqual(new Date(cycleCreatedAt))
    expect(mapped.cycle?.items[0]?.acceptedAt).toEqual(new Date(acceptedAt))
    expect(mapped.cycle?.items[1]?.acceptedAt).toBeNull()
  })

  it('gives an unclaimed offer no cycle', () => {
    const mapped = mapExchangeRequest({
      ...openRequest,
      createdAt: { epochMilliseconds: Date.parse('2025-01-02T00:00:00.000Z') },
      updatedAt: { epochMilliseconds: Date.parse('2025-01-02T00:00:00.000Z') },
      cycles: [],
    })

    expect(mapped.cycle).toBeNull()
  })

  it('lists the authenticated user exchanges with all filters and pagination', async () => {
    let receivedUserId = ''
    let receivedFilters: unknown
    const { get } = createUsersApp(
      { findByUserId: async () => [] },
      { findByUserId: async () => [] },
      {
        async findForUser(userId, filters) {
          receivedUserId = userId
          receivedFilters = filters
          return page
        },
      },
    )

    const { status, contentType, body } = await get(
      '/v1/users/me/exchanges?role=received&status=MATCHED&type=URGENT&page=2&limit=5',
    )

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(receivedUserId).toBe(TEST_USER.id)
    expect(receivedFilters).toEqual({
      role: 'received',
      status: 'MATCHED',
      type: 'URGENT',
      page: 2,
      limit: 5,
    })
    expect(body).toEqual({
      page: { current: 2, has_next: true, has_previous: true },
      data: [serialize(matchedRequest)],
    })
  })

  it('uses all, page one and the default limit when filters are omitted', async () => {
    let receivedFilters: unknown
    const { get } = createUsersApp(
      { findByUserId: async () => [] },
      { findByUserId: async () => [] },
      {
        async findForUser(_userId, filters) {
          receivedFilters = filters
          return { ...page, current: 1, hasPrevious: false, data: [openRequest] }
        },
      },
    )

    const { status, body } = await get('/v1/users/me/exchanges')

    expect(status).toBe(200)
    expect(receivedFilters).toEqual({ role: 'all', page: 1, limit: 10, status: undefined, type: undefined })
    expect((body as { data: unknown[] }).data).toEqual([serialize(openRequest)])
  })

  it('rejects the legacy PENDING status with a validation error', async () => {
    const { get } = createUsersApp(
      { findByUserId: async () => [] },
      { findByUserId: async () => [] },
      { findForUser: async () => page },
    )

    const { status, body } = await get('/v1/users/me/exchanges?status=PENDING')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('rejects anonymous callers', async () => {
    const { get } = createUsersApp(
      { findByUserId: async () => [] },
      { findByUserId: async () => [] },
      { findForUser: async () => page },
    )

    const { status, body } = await get('/v1/users/me/exchanges', { cookie: null })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })
})
