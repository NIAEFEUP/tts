import { describe, expect, it } from 'bun:test'

import type { ExchangeRequestPage } from '@/domain/ports/exchange.repository'

import { TEST_USER } from '../support/auth-test-utils'
import { UNAUTHORIZED_BODY } from '../support/catalog-test-utils'
import { createUsersApp } from '../support/user-test-utils'

const page: ExchangeRequestPage = {
  current: 2,
  hasNext: true,
  hasPrevious: true,
  data: [
    {
      id: 'request-1',
      creatorId: TEST_USER.id,
      targetUserId: '202399999',
      type: 'DIRECT',
      status: 'PENDING',
      message: null,
      adminState: 'UNTREATED',
      createdAt: new Date('2025-01-02T00:00:00.000Z'),
      updatedAt: new Date('2025-01-02T00:00:00.000Z'),
      items: [],
    },
  ],
}

describe('exchange routes', () => {
  it('lists the authenticated user exchanges with all filters and pagination', async () => {
    let receivedUserId = ''
    let receivedFilters: unknown
    const { get } = createUsersApp(
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
      '/v1/users/me/exchanges?role=received&status=ACCEPTED&type=URGENT&page=2&limit=5',
    )

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(receivedUserId).toBe(TEST_USER.id)
    expect(receivedFilters).toEqual({
      role: 'received',
      status: 'ACCEPTED',
      type: 'URGENT',
      page: 2,
      limit: 5,
    })
    expect(body).toEqual({
      page: { current: 2, has_next: true, has_previous: true },
      data: [
        {
          ...page.data[0],
          createdAt: page.data[0]!.createdAt.toISOString(),
          updatedAt: page.data[0]!.updatedAt.toISOString(),
        },
      ],
    })
  })

  it('uses all, page one and the default limit when filters are omitted', async () => {
    let receivedFilters: unknown
    const { get } = createUsersApp(
      { findByUserId: async () => [] },
      {
        async findForUser(_userId, filters) {
          receivedFilters = filters
          return { ...page, current: 1, hasPrevious: false }
        },
      },
    )

    const { status } = await get('/v1/users/me/exchanges')

    expect(status).toBe(200)
    expect(receivedFilters).toEqual({ role: 'all', page: 1, limit: 10, status: undefined, type: undefined })
  })

  it('rejects anonymous callers', async () => {
    const { get } = createUsersApp({ findByUserId: async () => [] }, { findForUser: async () => page })

    const { status, body } = await get('/v1/users/me/exchanges', { cookie: null })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })
})
