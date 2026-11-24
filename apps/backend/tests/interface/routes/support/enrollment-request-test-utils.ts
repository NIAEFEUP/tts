import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import type { UserRole } from '@/core/auth/user'
import type {
  EnrollmentRequest,
  EnrollmentRequestOption,
  EnrollmentRequestRepository,
  NewEnrollmentRequestOption,
} from '@/domain/ports/enrollment-request.repository'
import type { ExchangePeriod } from '@/domain/ports/exchange-period.repository'
import { createApp } from '@/main'
import type { App } from '@/main'

import { TEST_USER, createFakeSessions } from './auth-test-utils'
import { request } from './http-test-utils'
import type { ApiResponse, HttpMethod, RequestOptions } from './http-test-utils'
import {
  COURSE_UNITS,
  OCCURRENCES,
  createFakeExchangePeriodsRepository,
  createFakeOccurrenceRepository,
} from './catalog-test-utils'
import { createFakeAdminEnrollmentRequestRepository } from './admin-test-utils'

// Harness for the `/v1/enrollment-requests` route tests. Like the other
// `support/` modules it drives the real app through `app.handle(request)` with
// in-memory repositories: no listener and no database.

export const OTHER_USER_ID = '202054321'

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

/** A wide open window for every occurrence fixture, independent of test runtime. */
export const OPEN_PERIODS: ExchangePeriod[] = OCCURRENCES.map((occurrence) => ({
  id: `open-${occurrence.id}-${occurrence.year}`,
  occurrenceId: occurrence.id,
  occurrenceYear: occurrence.year,
  startsAt: new Date('2000-01-01T00:00:00.000Z'),
  endsAt: new Date('2100-01-01T00:00:00.000Z'),
}))

/** The same occurrences, but every window is far in the past. */
export const CLOSED_PERIODS: ExchangePeriod[] = OCCURRENCES.map((occurrence) => ({
  id: `closed-${occurrence.id}-${occurrence.year}`,
  occurrenceId: occurrence.id,
  occurrenceYear: occurrence.year,
  startsAt: new Date('1990-01-01T00:00:00.000Z'),
  endsAt: new Date('1991-01-01T00:00:00.000Z'),
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
      // Mirror the repository: the duplicate check runs at write time, so the
      // tests exercise the transactional path rather than a pre-check.
      for (const option of options) {
        const duplicate = [...store.values()].some(
          (request) =>
            request.userId === userId &&
            request.status !== 'CANCELLED' &&
            request.options.some(
              (existing) =>
                existing.occurrence.id === option.occurrenceId && existing.occurrence.year === option.occurrenceYear,
            ),
        )
        if (duplicate) {
          return {
            kind: 'duplicate' as const,
            occurrenceId: option.occurrenceId,
            occurrenceYear: option.occurrenceYear,
          }
        }
      }

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
      return { kind: 'created' as const, request }
    },

    async withdraw(id) {
      const request = store.get(id)
      if (!request || request.status !== 'PENDING') return false

      request.status = 'CANCELLED'
      request.updatedAt = new Date()
      return true
    },
  }

  return { repository, requests: store }
}

/** An enrollment repository that only answers `isEnrolledInOccurrence`. */
export function createFakeEnrollmentRepository(
  enrolled: Array<{ userId: string; occurrenceId: number; occurrenceYear: number }> = [],
): EnrollmentRepository {
  const keys = new Set(enrolled.map((row) => `${row.userId}:${row.occurrenceId}:${row.occurrenceYear}`))

  return {
    findByUserId: async () => [],
    sharesOccurrence: async () => false,
    isEnrolledInOccurrence: async (userId, occurrenceId, occurrenceYear) =>
      keys.has(`${userId}:${occurrenceId}:${occurrenceYear}`),
  }
}

/** The methods this route group exposes (alias of the shared `HttpMethod`). */
export type RouteMethod = HttpMethod

export type RouteResponse = ApiResponse

export type RouteRequestOptions = RequestOptions

/**
 * A `request(method, path)` bound to `app`, signed in unless told otherwise.
 * Thin adapter over `http-test-utils` so these tests keep their method-first
 * call shape while sharing the request/response plumbing with every other
 * route group.
 */
export function createRouteRequest(app: App) {
  return (method: HttpMethod, path: string, options: RequestOptions = {}): Promise<ApiResponse> =>
    request(app, path, { ...options, method })
}

export type EnrollmentRequestsAppOptions = {
  requests?: EnrollmentRequest[]
  exchangePeriods?: ExchangePeriod[]
  enrolledOccurrences?: Array<{ userId: string; occurrenceId: number; occurrenceYear: number }>
  role?: UserRole
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
  role,
}: EnrollmentRequestsAppOptions = {}) {
  const { repository } = createFakeEnrollmentRequestRepository({ requests })
  const app = createApp({
    repositories: {
      enrollmentRequestRepository: repository,
      enrollmentRepository: createFakeEnrollmentRepository(enrolledOccurrences),
      occurrenceRepository: createFakeOccurrenceRepository(),
      exchangePeriodsRepository: createFakeExchangePeriodsRepository({ exchangePeriods }),
      sessionRepository: createFakeSessions(role ? { ...TEST_USER, role } : undefined),
      adminEnrollmentRequestRepository: createFakeAdminEnrollmentRequestRepository(requests),
    },
  })

  return { app, request: createRouteRequest(app) }
}
