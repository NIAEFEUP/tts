import { describe, expect, it } from 'bun:test'

import { COURSE_UNITS, FORBIDDEN_BODY, OCCURRENCES, UNAUTHORIZED_BODY } from '../support/catalog-test-utils'
import { ADMIN, TEST_USER, createFakeSessions } from '../support/auth-test-utils'
import { fakeClassIds, fakeUserName } from '../support/admin-test-utils'
import type { FakeEnrollment } from '../support/admin-test-utils'
import {
  OTHER_USER_ID,
  createEnrollmentRequestsApp,
  makeRequest,
  occurrenceOption,
} from '../support/enrollment-request-test-utils'
import { createApp } from '@/main'

const LIST = '/v1/admin/enrollment-requests'
const accept = (id: string) => `${LIST}/${id}/accept`
const reject = (id: string) => `${LIST}/${id}/reject`

const errorCode = (body: unknown) => (body as { code: string }).code
const listedIds = (body: unknown) => (body as { requests: Array<{ id: string }> }).requests.map((row) => row.id)

// The student who makes the requests. The signed-in admin is `TEST_USER`.
const STUDENT = OTHER_USER_ID

// Occurrences of the fixtures: 587177/2025 and 587179/2025 are in different units.
const IN_SCOPE = { id: 587177, year: 2025 }
const OUT_OF_SCOPE = { id: 587179, year: 2025 }

const NO_SCOPE_PAGE = { requests: [], page: 1, pageSize: 20, total: 0, totalPages: 0 }

// Course and curricular year of the first occurrence, read from the fixtures.
const IN_SCOPE_OCCURRENCE = OCCURRENCES.find((row) => row.id === IN_SCOPE.id && row.year === IN_SCOPE.year)!
const IN_SCOPE_COURSE = IN_SCOPE_OCCURRENCE.courseId
const IN_SCOPE_UNIT_YEAR = COURSE_UNITS.find((unit) => unit.id === IN_SCOPE_OCCURRENCE.courseUnitId)!.courseUnitYear

const enroll = (userId: string, occurrence: { id: number; year: number }, index: 0 | 1): FakeEnrollment => ({
  userId,
  classId: fakeClassIds(occurrence.id, occurrence.year)[index]!,
})

describe('admin enrollment requests routes', () => {
  describe('authentication and role', () => {
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

    for (const [name, path] of [
      ['accept', accept('req-auth')],
      ['reject', reject('req-auth')],
    ] as const) {
      const pending = makeRequest({
        id: 'req-auth',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })

      it(`answers 401 to an anonymous POST ${name}`, async () => {
        const adminEnrollments: FakeEnrollment[] = []
        const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'ADMIN', adminEnrollments })

        const result = await request('POST', path, { cookie: null })
        expect(result.status).toBe(401)
        expect(result.body).toEqual(UNAUTHORIZED_BODY)
        expect(adminEnrollments).toEqual([])
      })

      it(`answers 403 to a signed-in non-admin POST ${name} and changes nothing`, async () => {
        const adminEnrollments: FakeEnrollment[] = []
        const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'USER', adminEnrollments })

        const result = await request('POST', path)
        expect(result.status).toBe(403)
        expect(result.body).toEqual(FORBIDDEN_BODY)
        expect(adminEnrollments).toEqual([])
      })
    }

    it('lets a SUPERUSER decide requests in their scope', async () => {
      const pending = makeRequest({
        id: 'req-super',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'SUPERUSER' })

      const result = await request('POST', accept('req-super'))
      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({ id: 'req-super', status: 'ACCEPTED', adminState: 'TREATED' })
    })
  })

  describe('GET list', () => {
    it('lists only requests with at least one option in my scope, and no other admin scope leaks in', async () => {
      const inScope = makeRequest({
        id: 'req-in',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const outOfScope = makeRequest({
        id: 'req-out',
        userId: STUDENT,
        options: [occurrenceOption(OUT_OF_SCOPE.id, OUT_OF_SCOPE.year, false)],
      })
      const mixed = makeRequest({
        id: 'req-mixed',
        userId: STUDENT,
        options: [
          occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true),
          occurrenceOption(OUT_OF_SCOPE.id, OUT_OF_SCOPE.year, false),
        ],
      })
      const { request } = createEnrollmentRequestsApp({
        requests: [inScope, outOfScope, mixed],
        role: 'ADMIN',
        occurrenceScopes: {
          [TEST_USER.id]: [IN_SCOPE],
          // Another admin's scope must not leak into mine.
          up000000000: [OUT_OF_SCOPE],
        },
      })

      const { status, body } = await request('GET', LIST)
      expect(status).toBe(200)
      expect(listedIds(body).sort()).toEqual(['req-in', 'req-mixed'])
      expect(body).toMatchObject({ total: 2 })
    })

    it('returns an empty page when I have no scope', async () => {
      const pending = makeRequest({
        id: 'req-unscoped',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const { request } = createEnrollmentRequestsApp({
        requests: [pending],
        role: 'ADMIN',
        // Only someone else has scope.
        occurrenceScopes: { up000000000: [IN_SCOPE] },
      })

      const { status, body } = await request('GET', LIST)
      expect(status).toBe(200)
      expect(body).toEqual(NO_SCOPE_PAGE)
    })

    it('tells the admin whose request it is', async () => {
      const pending = makeRequest({
        id: 'req-owner',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'ADMIN' })

      const listed = await request('GET', LIST)
      expect(listed.status).toBe(200)
      expect((listed.body as { requests: unknown[] }).requests[0]).toMatchObject({
        id: 'req-owner',
        userId: STUDENT,
        userName: fakeUserName(STUDENT),
      })

      const accepted = await request('POST', accept('req-owner'))
      expect(accepted.status).toBe(200)
      expect(accepted.body).toMatchObject({ userId: STUDENT, userName: fakeUserName(STUDENT) })
    })

    it('paginates newest first', async () => {
      const requests = ['a', 'b', 'c'].map((suffix, index) =>
        makeRequest({
          id: `req-${suffix}`,
          userId: STUDENT,
          options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
          createdAt: new Date(`2026-02-0${index + 1}T10:00:00Z`),
        }),
      )
      const { request } = createEnrollmentRequestsApp({ requests, role: 'ADMIN' })

      const first = await request('GET', `${LIST}?page=1&page_size=2`)
      expect(first.status).toBe(200)
      expect(first.body).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 })
      expect(listedIds(first.body)).toEqual(['req-c', 'req-b'])

      const second = await request('GET', `${LIST}?page=2&page_size=2`)
      expect(listedIds(second.body)).toEqual(['req-a'])

      const beyond = await request('GET', `${LIST}?page=3&page_size=2`)
      expect(beyond.body).toMatchObject({ requests: [], page: 3, total: 3, totalPages: 2 })
    })

    it('filters by course, curricular year and state', async () => {
      const untreated = makeRequest({
        id: 'req-untreated',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const awaiting = makeRequest({
        id: 'req-awaiting',
        userId: STUDENT,
        adminState: 'AWAITING_INFORMATION',
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, false)],
      })
      const rejected = makeRequest({
        id: 'req-rejected',
        userId: STUDENT,
        adminState: 'REJECTED',
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, false)],
      })
      const { request } = createEnrollmentRequestsApp({ requests: [untreated, awaiting, rejected], role: 'ADMIN' })
      const total = async (query: string) =>
        ((await request('GET', `${LIST}?${query}`)).body as { total: number }).total

      expect(await total(`activeCourse=${IN_SCOPE_COURSE}`)).toBe(3)
      expect(await total(`activeCourse=${IN_SCOPE_COURSE + 1}`)).toBe(0)

      expect(await total(`activeCurricularYear=${IN_SCOPE_UNIT_YEAR}`)).toBe(3)
      expect(await total(`activeCurricularYear=${IN_SCOPE_UNIT_YEAR + 1}`)).toBe(0)

      expect(await total('activeStates=UNTREATED')).toBe(1)
      expect(await total('activeStates=UNTREATED,AWAITING_INFORMATION')).toBe(2)
      expect(await total(`activeStates=REJECTED&activeCourse=${IN_SCOPE_COURSE + 1}`)).toBe(0)
    })

    it('does not list withdrawn requests', async () => {
      const pending = makeRequest({
        id: 'req-listed',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
        createdAt: new Date('2026-02-05T10:00:00Z'),
      })
      const cancelled = makeRequest({
        id: 'req-withdrawn',
        userId: STUDENT,
        status: 'CANCELLED',
        options: [occurrenceOption(587178, 2024, false)],
        createdAt: new Date('2026-02-06T10:00:00Z'),
      })
      const { request } = createEnrollmentRequestsApp({ requests: [pending, cancelled], role: 'ADMIN' })

      const { status, body } = await request('GET', LIST)
      expect(status).toBe(200)
      expect(listedIds(body)).toEqual(['req-listed'])
      expect(body).toMatchObject({ total: 1 })
    })

    it('rejects an unknown activeStates value with a 400 instead of an empty page', async () => {
      const { request } = createEnrollmentRequestsApp({ role: 'ADMIN' })

      const { status, body } = await request('GET', `${LIST}?activeStates=PENDNG`)
      expect(status).toBe(400)
      expect(errorCode(body)).toBe('invalid-active-states')

      const mixed = await request('GET', `${LIST}?activeStates=UNTREATED,PENDNG`)
      expect(mixed.status).toBe(400)
      expect(errorCode(mixed.body)).toBe('invalid-active-states')
    })
  })

  describe('POST accept', () => {
    it('accepts a pending request and rejects later decisions as 409', async () => {
      const pending = makeRequest({
        id: 'req-pending',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'ADMIN' })

      const accepted = await request('POST', accept('req-pending'))
      expect(accepted.status).toBe(200)
      expect(accepted.body).toMatchObject({ id: 'req-pending', status: 'ACCEPTED', adminState: 'TREATED' })

      const decidedAgain = await request('POST', reject('req-pending'))
      expect(decidedAgain.status).toBe(409)
      expect(errorCode(decidedAgain.body)).toBe('enrollment-request-not-pending')
    })

    it('accepts a request that is awaiting information', async () => {
      const awaiting = makeRequest({
        id: 'req-awaiting',
        userId: STUDENT,
        adminState: 'AWAITING_INFORMATION',
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const { request } = createEnrollmentRequestsApp({ requests: [awaiting], role: 'ADMIN' })

      const result = await request('POST', accept('req-awaiting'))
      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({ id: 'req-awaiting', status: 'ACCEPTED', adminState: 'TREATED' })
    })

    it('enrolls the student in exactly one class of the occurrence: the lowest id', async () => {
      const pending = makeRequest({
        id: 'req-enroll',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const adminEnrollments: FakeEnrollment[] = []
      const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'ADMIN', adminEnrollments })

      const result = await request('POST', accept('req-enroll'))
      expect(result.status).toBe(200)
      expect(adminEnrollments).toEqual([enroll(STUDENT, IN_SCOPE, 0)])
    })

    it('adds nothing when the student is already in a class of the occurrence', async () => {
      const pending = makeRequest({
        id: 'req-already',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const adminEnrollments = [enroll(STUDENT, IN_SCOPE, 1)]
      const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'ADMIN', adminEnrollments })

      const result = await request('POST', accept('req-already'))
      expect(result.status).toBe(200)
      expect(adminEnrollments).toEqual([enroll(STUDENT, IN_SCOPE, 1)])
    })

    it('removes the enrollments of the dropped occurrence and leaves everything else alone', async () => {
      const pending = makeRequest({
        id: 'req-drop',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, false)],
      })
      const otherOccurrence = { id: 587178, year: 2024 }
      const adminEnrollments = [
        enroll(STUDENT, IN_SCOPE, 0),
        enroll(STUDENT, IN_SCOPE, 1),
        // Same student, another occurrence.
        enroll(STUDENT, otherOccurrence, 0),
        // Another student, the same occurrence.
        enroll(TEST_USER.id, IN_SCOPE, 0),
      ]
      const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'ADMIN', adminEnrollments })

      const result = await request('POST', accept('req-drop'))
      expect(result.status).toBe(200)
      expect(adminEnrollments).toEqual([enroll(STUDENT, otherOccurrence, 0), enroll(TEST_USER.id, IN_SCOPE, 0)])
    })

    it('answers occurrence-has-no-classes, not not-pending, and changes nothing', async () => {
      const pending = makeRequest({
        id: 'req-no-classes',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const adminEnrollments: FakeEnrollment[] = []
      const { request } = createEnrollmentRequestsApp({
        requests: [pending],
        role: 'ADMIN',
        occurrencesWithoutClasses: [IN_SCOPE],
        adminEnrollments,
      })

      const result = await request('POST', accept('req-no-classes'))
      expect(result.status).toBe(409)
      expect(errorCode(result.body)).toBe('occurrence-has-no-classes')
      expect(adminEnrollments).toEqual([])

      // The request is still pending, so it can be rejected.
      const rejected = await request('POST', reject('req-no-classes'))
      expect(rejected.status).toBe(200)
      expect(rejected.body).toMatchObject({ status: 'PENDING', adminState: 'REJECTED' })
    })

    it('accepts a drop request even when the occurrence has no classes', async () => {
      const pending = makeRequest({
        id: 'req-drop-no-classes',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, false)],
      })
      const { request } = createEnrollmentRequestsApp({
        requests: [pending],
        role: 'ADMIN',
        occurrencesWithoutClasses: [IN_SCOPE],
      })

      const result = await request('POST', accept('req-drop-no-classes'))
      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({ status: 'ACCEPTED', adminState: 'TREATED' })
    })

    it('returns 404 for unknown requests and 409 for cancelled requests', async () => {
      const cancelled = makeRequest({
        id: 'req-cancelled',
        userId: STUDENT,
        status: 'CANCELLED',
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const { request } = createEnrollmentRequestsApp({ requests: [cancelled], role: 'ADMIN' })

      const missing = await request('POST', accept('missing'))
      expect(missing.status).toBe(404)
      expect(errorCode(missing.body)).toBe('enrollment-request-not-found')

      const decided = await request('POST', accept('req-cancelled'))
      expect(decided.status).toBe(409)
      expect(errorCode(decided.body)).toBe('enrollment-request-not-pending')
    })
  })

  describe('POST reject', () => {
    it('rejects a pending request without changing its status or the enrollments', async () => {
      const pending = makeRequest({
        id: 'req-reject',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true), occurrenceOption(587178, 2024, false)],
      })
      const adminEnrollments = [enroll(STUDENT, { id: 587178, year: 2024 }, 0)]
      const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'ADMIN', adminEnrollments })

      const result = await request('POST', reject('req-reject'))
      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({ id: 'req-reject', status: 'PENDING', adminState: 'REJECTED' })
      expect(adminEnrollments).toEqual([enroll(STUDENT, { id: 587178, year: 2024 }, 0)])
    })

    it('treats a rejection as final: it can be neither accepted nor rejected again', async () => {
      const pending = makeRequest({
        id: 'req-final',
        userId: STUDENT,
        options: [occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true)],
      })
      const adminEnrollments: FakeEnrollment[] = []
      const { request } = createEnrollmentRequestsApp({ requests: [pending], role: 'ADMIN', adminEnrollments })

      const rejected = await request('POST', reject('req-final'))
      expect(rejected.status).toBe(200)

      // `status` is still PENDING here, so only the admin state can stop this.
      const accepted = await request('POST', accept('req-final'))
      expect(accepted.status).toBe(409)
      expect(errorCode(accepted.body)).toBe('enrollment-request-not-pending')
      expect(adminEnrollments).toEqual([])

      const rejectedAgain = await request('POST', reject('req-final'))
      expect(rejectedAgain.status).toBe(409)
      expect(errorCode(rejectedAgain.body)).toBe('enrollment-request-not-pending')
    })
  })

  describe('scope on decisions', () => {
    const mixed = makeRequest({
      id: 'req-mixed',
      userId: STUDENT,
      options: [
        occurrenceOption(IN_SCOPE.id, IN_SCOPE.year, true),
        occurrenceOption(OUT_OF_SCOPE.id, OUT_OF_SCOPE.year, false),
      ],
    })

    for (const [name, path] of [
      ['accept', accept('req-mixed')],
      ['reject', reject('req-mixed')],
    ] as const) {
      it(`answers 403 to ${name} when one option is in scope and another is not, and changes nothing`, async () => {
        const adminEnrollments = [enroll(STUDENT, OUT_OF_SCOPE, 0)]
        const { request } = createEnrollmentRequestsApp({
          requests: [mixed],
          role: 'ADMIN',
          occurrenceScopes: { [TEST_USER.id]: [IN_SCOPE] },
          adminEnrollments,
        })

        const result = await request('POST', path)
        expect(result.status).toBe(403)
        expect(result.body).toEqual(FORBIDDEN_BODY)
        expect(adminEnrollments).toEqual([enroll(STUDENT, OUT_OF_SCOPE, 0)])

        // Still untouched: pending and untreated.
        const listed = await request('GET', LIST)
        expect((listed.body as { requests: unknown[] }).requests[0]).toMatchObject({
          id: 'req-mixed',
          status: 'PENDING',
          adminState: 'UNTREATED',
        })
      })

      it(`answers 403 to ${name} when I have no scope at all`, async () => {
        const { request } = createEnrollmentRequestsApp({
          requests: [mixed],
          role: 'ADMIN',
          occurrenceScopes: {},
        })

        const result = await request('POST', path)
        expect(result.status).toBe(403)
        expect(result.body).toEqual(FORBIDDEN_BODY)
      })
    }

    it('answers 404 for an unknown request even without scope', async () => {
      const { request } = createEnrollmentRequestsApp({ requests: [mixed], role: 'ADMIN', occurrenceScopes: {} })

      const result = await request('POST', accept('missing'))
      expect(result.status).toBe(404)
      expect(errorCode(result.body)).toBe('enrollment-request-not-found')
    })
  })

  it('uses the admin fixture identity', () => {
    expect(ADMIN.role).toBe('ADMIN')
  })
})
