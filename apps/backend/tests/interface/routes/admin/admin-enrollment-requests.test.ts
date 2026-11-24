import { describe, expect, it } from 'bun:test'

import { FORBIDDEN_BODY, UNAUTHORIZED_BODY } from '../support/catalog-test-utils'
import { ADMIN, TEST_USER } from '../support/auth-test-utils'
import { createEnrollmentRequestsApp, makeRequest, occurrenceOption } from '../support/enrollment-request-test-utils'
import { createFakeSessions } from '../support/auth-test-utils'
import { createApp } from '@/main'

const LIST = '/v1/admin/enrollment-requests'
const accept = (id: string) => `${LIST}/${id}/accept`
const reject = (id: string) => `${LIST}/${id}/reject`

describe('admin enrollment requests routes', () => {
  it('requires authentication and an admin role', async () => {
    const anon = createEnrollmentRequestsApp()
    const anonResult = await anon.request('GET', LIST, { cookie: null })
    expect(anonResult.status).toBe(401)
    expect(anonResult.body).toEqual(UNAUTHORIZED_BODY)

    const app = createApp({
      repositories: {
        sessionRepository: createFakeSessions({ ...TEST_USER, role: 'USER' }),
      },
    })
    const { request } = await import('../support/http-test-utils')
    const userResult = await request(app, LIST)
    expect(userResult.status).toBe(403)
    expect(userResult.body).toEqual(FORBIDDEN_BODY)
  })

  it('lists in scope with pagination and filters', async () => {
    const pending = makeRequest({
      id: 'req-admin',
      userId: TEST_USER.id,
      options: [occurrenceOption(587177, 2025, true)],
      createdAt: new Date('2026-02-05T10:00:00Z'),
    })
    const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'ADMIN' })

    const first = await request('GET', `${LIST}?page=1&page_size=1&activeStates=UNTREATED&activeCourse=22841`)
    expect(first.status).toBe(200)
    expect(first.body).toMatchObject({
      page: 1,
      pageSize: 1,
      total: 1,
      totalPages: 1,
    })

    const second = await request('GET', `${LIST}?page=2&page_size=1`)
    expect(second.status).toBe(200)
    expect(second.body).toMatchObject({ requests: [], page: 2, total: 1, totalPages: 1 })
  })

  it('accepts a pending request and rejects later decisions as 409', async () => {
    const pending = makeRequest({
      id: 'req-pending',
      userId: TEST_USER.id,
      options: [occurrenceOption(587177, 2025, true)],
    })
    const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'ADMIN' })

    const accepted = await request('POST', accept('req-pending'))
    expect(accepted.status).toBe(200)
    expect(accepted.body).toMatchObject({ id: 'req-pending', status: 'ACCEPTED', adminState: 'TREATED' })

    const decidedAgain = await request('POST', reject('req-pending'))
    expect(decidedAgain.status).toBe(409)
    expect((decidedAgain.body as { code: string }).code).toBe('enrollment-request-not-pending')
  })

  it('rejects a pending request without changing its status', async () => {
    const pending = makeRequest({
      id: 'req-reject',
      userId: TEST_USER.id,
      options: [occurrenceOption(587179, 2025, false)],
    })
    const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'ADMIN' })

    const result = await request('POST', reject('req-reject'))
    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ id: 'req-reject', status: 'PENDING', adminState: 'REJECTED' })
  })

  it('returns 404 for unknown requests and 409 for cancelled requests', async () => {
    const cancelled = makeRequest({
      id: 'req-cancelled',
      userId: TEST_USER.id,
      status: 'CANCELLED',
      options: [occurrenceOption(587177, 2025, true)],
    })
    const { request } = createEnrollmentRequestsApp({ requests: [cancelled], role: 'ADMIN' })

    const missing = await request('POST', accept('missing'))
    expect(missing.status).toBe(404)
    expect((missing.body as { code: string }).code).toBe('enrollment-request-not-found')

    const decided = await request('POST', accept('req-cancelled'))
    expect(decided.status).toBe(409)
  })

  it('uses the admin fixture identity', () => {
    expect(ADMIN.role).toBe('ADMIN')
  })
})
