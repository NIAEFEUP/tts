import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import type {
  EnrollmentRequest,
  EnrollmentRequestOption,
  EnrollmentRequestRepository,
  NewEnrollmentRequestOption,
} from '@/domain/ports/enrollment-request.repository'
import type { ExchangePeriod } from '@/domain/ports/exchange-period.repository'
import { createApp } from '@/main'
import type { App } from '@/main'

import { TEST_SESSION_TOKEN, TEST_USER, createFakeSessions } from './auth-test-utils'
import {
  COURSE_UNITS,
  OCCURRENCES,
  createFakeExchangePeriodsRepository,
  createFakeOccurrenceRepository,
} from './catalog-test-utils'

// Harness for the `/v1/enrollment-requests` route tests. Like the other
// `support/` modules it drives the real app through `app.handle(request)` with
// in-memory repositories: no listener and no database.

const OTHER_USER_ID = '202054321'

/** Looks up an occurrence and its course unit to build a request option view. */
export function occurrenceOption(
  occurrenceId: number,
  occurrenceYear: number,
  enrolling = true,
): EnrollmentRequestOption {
  const occurrence = OCCURRENCES.find((row) => row.id === occurrenceId && row.year === occurrenceYear)
  if (!occurrence) throw new Error(`No occurrence fixture for ${occurrenceId}:${occurrenceYear}`)

  const courseUnit = COURSE_UNITS.find((unit) => unit.id === occurrence.courseUnitId)
  if (!courseUnit) throw new Error(`No course unit fixture for occurrence ${occurrenceId}:${occurrenceYear}`)

  return {
    occurrence: {
      id: occurrence.id,
      year: occurrence.year,
      courseUnit: {
        id: courseUnit.id,
        acronym: courseUnit.acronym,
        name: courseUnit.name,
        semester: courseUnit.semester,
      },
    },
    enrolling,
  }
}

/** Builds a domain request with stable timestamps for deterministic responses. */
export function makeRequest({
  id,
  userId,
  options,
  status = 'PENDING',
  adminState = 'UNTREATED',
  createdAt = new Date('2026-02-01T10:00:00.000Z'),
}: {
  id: string
  userId: string
  options: EnrollmentRequestOption[]
  status?: EnrollmentRequest['status']
  adminState?: EnrollmentRequest['adminState']
  createdAt?: Date
}): EnrollmentRequest {
  return { id, userId, status, adminState, createdAt, updatedAt: createdAt, options }
}

export const MY_REQUEST = makeRequest({
  id: 'req-mine',
  userId: TEST_USER.id,
  options: [occurrenceOption(587177, 2025, true)],
  createdAt: new Date('2026-02-02T10:00:00.000Z'),
})

export const OTHER_REQUEST = makeRequest({
  id: 'req-other',
  userId: OTHER_USER_ID,
  options: [occurrenceOption(587179, 2025, false)],
  createdAt: new Date('2026-02-03T10:00:00.000Z'),
})

export const CANCELLED_REQUEST = makeRequest({
  id: 'req-cancelled',
  userId: TEST_USER.id,
  status: 'CANCELLED',
  options: [occurrenceOption(587178, 2024, false)],
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
})

export const DEFAULT_REQUESTS = [MY_REQUEST, OTHER_REQUEST, CANCELLED_REQUEST]

/** An open window for every occurrence fixture, anchored to the test run. */
export const OPEN_PERIODS: ExchangePeriod[] = OCCURRENCES.map((occurrence) => ({
  occurrenceId: occurrence.id,
  occurrenceYear: occurrence.year,
  startsAt: new Date(Date.now() - 60_000),
  endsAt: new Date(Date.now() + 60_000),
}))

/** The same occurrences, but every window is in the past. */
export const CLOSED_PERIODS: ExchangePeriod[] = OCCURRENCES.map((occurrence) => ({
  occurrenceId: occurrence.id,
  occurrenceYear: occurrence.year,
  startsAt: new Date('2020-01-01T00:00:00.000Z'),
  endsAt: new Date('2020-01-02T00:00:00.000Z'),
}))

/**
 * A stateful in-memory `EnrollmentRequestRepository`. Creation assigns
 * `req-created-N` ids, `withdraw` flips PENDING to CANCELLED, and duplicate
 * detection mirrors the real repository: same occurrence, any direction,
 * ignoring cancelled requests.
 */
export function createFakeEnrollmentRequestRepository({
  requests = DEFAULT_REQUESTS,
}: { requests?: EnrollmentRequest[] } = {}): {
  repository: EnrollmentRequestRepository
  requests: Map<string, EnrollmentRequest>
} {
  const store = new Map(requests.map((request) => [request.id, structuredClone(request)]))
  let nextId = 1

  const repository: EnrollmentRequestRepository = {
    async findByUserId(userId) {
      return [...store.values()]
        .filter((request) => request.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },

    async findById(id) {
      return store.get(id) ?? null
    },

    async create({ userId, options }: { userId: string; options: NewEnrollmentRequestOption[] }) {
      const createdAt = new Date()
      const request: EnrollmentRequest = {
        id: `req-created-${nextId++}`,
        userId,
        status: 'PENDING',
        adminState: 'UNTREATED',
        createdAt,
        updatedAt: createdAt,
        options: options.map((option) =>
          occurrenceOption(option.occurrenceId, option.occurrenceYear, option.enrolling),
        ),
      }

      store.set(request.id, request)
      return request
    },

    async withdraw(id) {
      const request = store.get(id)
      if (!request || request.status !== 'PENDING') return false

      request.status = 'CANCELLED'
      request.updatedAt = new Date()
      return true
    },

    async hasActiveOptionForOccurrence({ userId, occurrenceId, occurrenceYear }) {
      return [...store.values()].some(
        (request) =>
          request.userId === userId &&
          request.status !== 'CANCELLED' &&
          request.options.some(
            (option) => option.occurrence.id === occurrenceId && option.occurrence.year === occurrenceYear,
          ),
      )
    },
  }

  return { repository, requests: store }
}

/** An enrollment repository that only answers `isEnrolledInOccurrence`. */
export function createFakeEnrollmentRepository(
  enrolled: Array<{ occurrenceId: number; occurrenceYear: number }> = [],
): EnrollmentRepository {
  const keys = new Set(enrolled.map((row) => `${row.occurrenceId}:${row.occurrenceYear}`))

  return {
    findByUserId: async () => [],
    sharesOccurrence: async () => false,
    isEnrolledInOccurrence: async (_userId, occurrenceId, occurrenceYear) =>
      keys.has(`${occurrenceId}:${occurrenceYear}`),
  }
}

export type RouteMethod = 'GET' | 'POST' | 'DELETE'

export type RouteResponse = {
  status: number
  contentType: string
  body: unknown
}

export type RouteRequestOptions = {
  /** Cookie header to send. Defaults to the signed-in test session; `null` sends none. */
  cookie?: string | null
  body?: unknown
}

/** A `request(method, path)` bound to `app`, signed in unless told otherwise. */
export function createRouteRequest(app: App) {
  return async (method: RouteMethod, path: string, options: RouteRequestOptions = {}): Promise<RouteResponse> => {
    const cookie = options.cookie === undefined ? `session=${TEST_SESSION_TOKEN}` : options.cookie
    const hasBody = options.body !== undefined
    const response = await app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
        },
        body: hasBody ? JSON.stringify(options.body) : undefined,
      }),
    )
    const contentType = response.headers.get('content-type') ?? ''

    return {
      status: response.status,
      contentType,
      body: contentType.startsWith('application/json') ? ((await response.json()) as unknown) : null,
    }
  }
}

export type EnrollmentRequestsAppOptions = {
  requests?: EnrollmentRequest[]
  exchangePeriods?: ExchangePeriod[]
  enrolledOccurrences?: Array<{ occurrenceId: number; occurrenceYear: number }>
}

/**
 * Builds the app with the enrollment-request fakes. `requests` seeds the
 * repository, `exchangePeriods` controls which occurrences are open, and
 * `enrolledOccurrences` feeds the already-enrolled rule.
 */
export function createEnrollmentRequestsApp({
  requests = DEFAULT_REQUESTS,
  exchangePeriods = OPEN_PERIODS,
  enrolledOccurrences = [],
}: EnrollmentRequestsAppOptions = {}) {
  const { repository } = createFakeEnrollmentRequestRepository({ requests })
  const app = createApp({
    repositories: {
      enrollmentRequestRepository: repository,
      enrollmentRepository: createFakeEnrollmentRepository(enrolledOccurrences),
      occurrenceRepository: createFakeOccurrenceRepository(),
      exchangePeriodsRepository: createFakeExchangePeriodsRepository({ exchangePeriods }),
      sessionRepository: createFakeSessions(),
    },
  })

  return { app, request: createRouteRequest(app) }
}
