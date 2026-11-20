import { describe, expect, it } from 'bun:test'

import { TEST_USER } from '../support/auth-test-utils'
import { UNAUTHORIZED_BODY, VALIDATION_ERROR_BODY } from '../support/catalog-test-utils'
import {
  CLOSED_PERIODS,
  createEnrollmentRequestsApp,
  makeRequest,
  occurrenceOption,
} from '../support/enrollment-request-test-utils'
import type { RouteMethod } from '../support/enrollment-request-test-utils'

const LIST_PATH = '/v1/enrollment-requests'
const detailPath = (id: string) => `${LIST_PATH}/${id}`

const postBody = (options: Array<{ occurrenceId: number; occurrenceYear: number; enrolling: boolean }>) => ({
  options,
})

const AUTH_REQUESTS: Array<{ method: RouteMethod; path: string; body?: unknown }> = [
  { method: 'GET', path: LIST_PATH },
  {
    method: 'POST',
    path: LIST_PATH,
    body: postBody([{ occurrenceId: 587177, occurrenceYear: 2025, enrolling: true }]),
  },
  { method: 'GET', path: detailPath('req-mine') },
  { method: 'DELETE', path: detailPath('req-mine') },
]

const errorCode = (body: unknown) => (body as { code: string }).code

describe('enrollment requests routes', () => {
  for (const route of AUTH_REQUESTS) {
    it(`${route.method} ${route.path} rejects an anonymous caller with a 401 unauthorized`, async () => {
      const { request } = createEnrollmentRequestsApp()
      const { status, body } = await request(route.method, route.path, { cookie: null, body: route.body })

      expect(status).toBe(401)
      expect(body).toEqual(UNAUTHORIZED_BODY)
    })

    it(`${route.method} ${route.path} rejects an unrecognised session cookie with a 401`, async () => {
      const { request } = createEnrollmentRequestsApp()
      const { status, body } = await request(route.method, route.path, {
        cookie: 'session=forged',
        body: route.body,
      })

      expect(status).toBe(401)
      expect(body).toEqual(UNAUTHORIZED_BODY)
    })
  }

  it('rejects an anonymous POST before validating its body', async () => {
    const { request } = createEnrollmentRequestsApp()

    for (const body of [{ options: [] }, undefined]) {
      const { status, body: responseBody } = await request('POST', LIST_PATH, { cookie: null, body })

      expect(status).toBe(401)
      expect(responseBody).toEqual(UNAUTHORIZED_BODY)
    }
  })

  it('lists only my requests, newest first', async () => {
    const { request } = createEnrollmentRequestsApp()
    const { status, body } = await request('GET', LIST_PATH)

    expect(status).toBe(200)

    const rows = body as Array<{
      id: string
      status: string
      adminState: string
      createdAt: string
      options: unknown[]
    }>

    expect(rows.map((row) => row.id)).toEqual(['req-mine', 'req-cancelled'])
    expect(rows[0]).toMatchObject({
      status: 'PENDING',
      adminState: 'UNTREATED',
      options: [
        {
          occurrence: {
            id: 587177,
            year: 2025,
            courseUnit: { id: 42, acronym: 'BD', name: 'Bases de Dados', semester: 1 },
          },
          enrolling: true,
        },
      ],
    })
    expect(rows[0].createdAt).toBe('2026-02-02T10:00:00.000Z')
  })

  it('returns an empty list when I have no requests', async () => {
    const { request } = createEnrollmentRequestsApp({ requests: [] })
    const { status, body } = await request('GET', LIST_PATH)

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('creates a request mixing enroll and drop options', async () => {
    const { request } = createEnrollmentRequestsApp({ requests: [] })
    const options = [
      { occurrenceId: 587177, occurrenceYear: 2025, enrolling: true },
      { occurrenceId: 587178, occurrenceYear: 2024, enrolling: false },
    ]

    const { status, contentType, body } = await request('POST', LIST_PATH, { body: postBody(options) })

    expect(status).toBe(201)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toMatchObject({
      id: expect.stringMatching(/^req-created-/),
      status: 'PENDING',
      adminState: 'UNTREATED',
      options: [occurrenceOption(587177, 2025, true), occurrenceOption(587178, 2024, false)],
    })

    const created = body as { id: string }
    const { body: listed } = await request('GET', LIST_PATH)
    const rows = listed as Array<{ id: string }>

    expect(rows.map((row) => row.id)).toEqual([created.id])
  })

  it('rejects an empty options array with a 422 validation-error', async () => {
    const { request } = createEnrollmentRequestsApp({ requests: [] })
    const { status, body } = await request('POST', LIST_PATH, { body: { options: [] } })

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('rejects the same occurrence twice in one payload', async () => {
    const { request } = createEnrollmentRequestsApp({ requests: [] })
    const options = [
      { occurrenceId: 587177, occurrenceYear: 2025, enrolling: true },
      { occurrenceId: 587177, occurrenceYear: 2025, enrolling: false },
    ]

    const { status, body } = await request('POST', LIST_PATH, { body: postBody(options) })

    expect(status).toBe(400)
    expect(errorCode(body)).toBe('duplicate-enrollment-option')
  })

  it('rejects a duplicate of an active request', async () => {
    const { request } = createEnrollmentRequestsApp()
    const { status, body } = await request('POST', LIST_PATH, {
      body: postBody([{ occurrenceId: 587177, occurrenceYear: 2025, enrolling: false }]),
    })

    expect(status).toBe(400)
    expect(errorCode(body)).toBe('duplicate-enrollment-request')
  })

  it('rejects a request for an occurrence whose exchange period is closed', async () => {
    const { request } = createEnrollmentRequestsApp({ requests: [], exchangePeriods: CLOSED_PERIODS })
    const { status, body } = await request('POST', LIST_PATH, {
      body: postBody([{ occurrenceId: 587177, occurrenceYear: 2025, enrolling: true }]),
    })

    expect(status).toBe(400)
    expect(errorCode(body)).toBe('exchange-period-closed')
  })

  it('rejects an enroll request for an occurrence I am already enrolled in', async () => {
    const { request } = createEnrollmentRequestsApp({
      requests: [],
      enrolledOccurrences: [{ occurrenceId: 587177, occurrenceYear: 2025 }],
    })
    const { status, body } = await request('POST', LIST_PATH, {
      body: postBody([{ occurrenceId: 587177, occurrenceYear: 2025, enrolling: true }]),
    })

    expect(status).toBe(400)
    expect(errorCode(body)).toBe('already-enrolled')
  })

  it('rejects an option that references an unknown occurrence', async () => {
    const { request } = createEnrollmentRequestsApp({ requests: [] })
    const { status, body } = await request('POST', LIST_PATH, {
      body: postBody([{ occurrenceId: 999999, occurrenceYear: 2025, enrolling: true }]),
    })

    expect(status).toBe(404)
    expect(errorCode(body)).toBe('occurrence-not-found')
  })

  it('allows resubmitting an occurrence after the previous request was cancelled', async () => {
    const { request } = createEnrollmentRequestsApp()
    const { status } = await request('POST', LIST_PATH, {
      body: postBody([{ occurrenceId: 587178, occurrenceYear: 2024, enrolling: false }]),
    })

    expect(status).toBe(201)
  })

  it('allows a drop request for an occurrence I am not enrolled in', async () => {
    const { request } = createEnrollmentRequestsApp({ requests: [] })
    const { status } = await request('POST', LIST_PATH, {
      body: postBody([{ occurrenceId: 587179, occurrenceYear: 2025, enrolling: false }]),
    })

    expect(status).toBe(201)
  })

  it('returns one of my requests by id', async () => {
    const { request } = createEnrollmentRequestsApp()
    const { status, body } = await request('GET', detailPath('req-mine'))

    expect(status).toBe(200)
    expect(body).toMatchObject({
      id: 'req-mine',
      status: 'PENDING',
      options: [occurrenceOption(587177, 2025, true)],
    })
  })

  it('forbids reading another student request', async () => {
    const { request } = createEnrollmentRequestsApp()
    const { status, body } = await request('GET', detailPath('req-other'))

    expect(status).toBe(403)
    expect(errorCode(body)).toBe('forbidden')
  })

  it('answers 404 for an unknown request id', async () => {
    const { request } = createEnrollmentRequestsApp()
    const { status, body } = await request('GET', detailPath('req-missing'))

    expect(status).toBe(404)
    expect(errorCode(body)).toBe('enrollment-request-not-found')
  })

  it('withdraws a pending request without deleting it', async () => {
    const { request } = createEnrollmentRequestsApp()
    const { status, body } = await request('DELETE', detailPath('req-mine'))

    expect(status).toBe(204)
    expect(body).toBeNull()

    const { status: detailStatus, body: detailBody } = await request('GET', detailPath('req-mine'))
    expect(detailStatus).toBe(200)
    expect(detailBody).toMatchObject({ id: 'req-mine', status: 'CANCELLED' })
  })

  it('answers 409 when withdrawing a request that is no longer pending', async () => {
    const { request } = createEnrollmentRequestsApp()

    const first = await request('DELETE', detailPath('req-mine'))
    expect(first.status).toBe(204)

    const second = await request('DELETE', detailPath('req-mine'))
    expect(second.status).toBe(409)
    expect(errorCode(second.body)).toBe('enrollment-request-not-pending')
  })

  it('forbids withdrawing another student request', async () => {
    const { request } = createEnrollmentRequestsApp()
    const { status, body } = await request('DELETE', detailPath('req-other'))

    expect(status).toBe(403)
    expect(errorCode(body)).toBe('forbidden')
  })

  it('answers 404 when withdrawing an unknown request', async () => {
    const { request } = createEnrollmentRequestsApp()
    const { status, body } = await request('DELETE', detailPath('req-missing'))

    expect(status).toBe(404)
    expect(errorCode(body)).toBe('enrollment-request-not-found')
  })

  it('forbids an accepted request from being withdrawn', async () => {
    const accepted = makeRequest({
      id: 'req-accepted',
      userId: TEST_USER.id,
      status: 'ACCEPTED',
      options: [occurrenceOption(587177, 2025, true)],
    })
    const { request } = createEnrollmentRequestsApp({ requests: [accepted] })
    const { status, body } = await request('DELETE', detailPath('req-accepted'))

    expect(status).toBe(409)
    expect(errorCode(body)).toBe('enrollment-request-not-pending')
  })
})
