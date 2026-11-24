import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import type { UserRole } from '@/core/auth/user'
import type {
  EnrollmentRequest,
  EnrollmentRequestOption,
  EnrollmentRequestRepository,
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

export const OTHER_USER_ID = '202054321'

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

export const OPEN_PERIODS: ExchangePeriod[] = OCCURRENCES.map((occurrence) => ({
  id: `open-${occurrence.id}-${occurrence.year}`,
  occurrenceId: occurrence.id,
  occurrenceYear: occurrence.year,
  startsAt: new Date('2000-01-01T00:00:00.000Z'),
  endsAt: new Date('2100-01-01T00:00:00.000Z'),
}))

export const CLOSED_PERIODS: ExchangePeriod[] = OCCURRENCES.map((occurrence) => ({
  id: `closed-${occurrence.id}-${occurrence.year}`,
  occurrenceId: occurrence.id,
  occurrenceYear: occurrence.year,
  startsAt: new Date('1990-01-01T00:00:00.000Z'),
  endsAt: new Date('1991-01-01T00:00:00.000Z'),
}))

export function createSharedEnrollmentRequestRepositories({
  requests = DEFAULT_REQUESTS,
}: { requests?: EnrollmentRequest[] } = {}) {
  const store = new Map(requests.map((request) => [request.id, structuredClone(request)]))
  let nextId = 1

  const enrollmentRequestRepository: EnrollmentRequestRepository = {
    async findByUserId(userId) {
      return [...store.values()]
        .filter((request) => request.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },
    async findById(id) {
      return store.get(id) ?? null
    },
    async create({ userId, options }) {
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

  const adminEnrollmentRequestRepository = {
    async findForAdmin(_adminUserId: string, filters: any) {
      const all = [...store.values()]
        .filter((request) => !filters.activeStates?.length || filters.activeStates.includes(request.adminState))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      const offset = (filters.page - 1) * filters.pageSize
      return {
        requests: all.slice(offset, offset + filters.pageSize),
        page: filters.page,
        pageSize: filters.pageSize,
        total: all.length,
        totalPages: all.length === 0 ? 0 : Math.ceil(all.length / filters.pageSize),
      }
    },

    async acceptForAdmin(_adminUserId: string, id: string) {
      const request = store.get(id)
      if (!request) return { kind: 'not-found' as const }
      if (request.status !== 'PENDING') return { kind: 'not-pending' as const }
      request.status = 'ACCEPTED'
      request.adminState = 'TREATED'
      request.updatedAt = new Date()
      return { kind: 'ok' as const, request }
    },

    async rejectForAdmin(_adminUserId: string, id: string) {
      const request = store.get(id)
      if (!request) return { kind: 'not-found' as const }
      if (request.status !== 'PENDING') return { kind: 'not-pending' as const }
      request.adminState = 'REJECTED'
      request.updatedAt = new Date()
      return { kind: 'ok' as const, request }
    },
  }

  return { enrollmentRequestRepository, adminEnrollmentRequestRepository, store }
}

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

export type RouteMethod = HttpMethod
export type RouteResponse = ApiResponse
export type RouteRequestOptions = RequestOptions

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

export function createEnrollmentRequestsApp({
  requests = DEFAULT_REQUESTS,
  exchangePeriods = OPEN_PERIODS,
  enrolledOccurrences = [],
  role,
}: EnrollmentRequestsAppOptions = {}) {
  const { enrollmentRequestRepository, adminEnrollmentRequestRepository } = createSharedEnrollmentRequestRepositories({
    requests,
  })
  const app = createApp({
    repositories: {
      enrollmentRequestRepository,
      enrollmentRepository: createFakeEnrollmentRepository(enrolledOccurrences),
      occurrenceRepository: createFakeOccurrenceRepository(),
      exchangePeriodsRepository: createFakeExchangePeriodsRepository({ exchangePeriods }),
      sessionRepository: createFakeSessions(role ? { ...TEST_USER, role } : undefined),
      adminEnrollmentRequestRepository,
    },
  })

  return { app, request: createRouteRequest(app) }
}
