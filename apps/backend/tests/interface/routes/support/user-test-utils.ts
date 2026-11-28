import type { ExchangeRepository } from '@/domain/ports/exchange.repository'
import type { EligibleOccurrenceRepository } from '@/domain/ports/eligible-occurrence.repository'
import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import { createApp } from '@/main'
import type { App } from '@/main'

import { createFakeSessions } from './auth-test-utils'
import { request } from './http-test-utils'
import type { ApiResponse, RequestOptions } from './http-test-utils'

// Shared harness for the `/v1/users/me/*` route tests. Like `catalog-test-utils`,
// it drives the real app through `app.handle(request)` with fake repositories:
// no listener and no database. `student-test-utils` builds on `createGet`.
// The request itself is built by `http-test-utils`.

type GetOptions = Pick<RequestOptions, 'cookie'>

/** A `get(path)` bound to `app`, signed in as the test session unless told otherwise. */
export function createGet(app: App) {
  return async (path: string, options: GetOptions = {}): Promise<ApiResponse> => request(app, path, options)
}

/**
 * `enrollmentRepository` only needs `findByUserId`; `sharesOccurrence` defaults
 * to "no", for the `/users/me/*` tests that never reach it.
 */
export function createUsersApp(
  enrollmentRepository: Pick<EnrollmentRepository, 'findByUserId'> & Partial<EnrollmentRepository> = {
    findByUserId: async () => [],
  },
  eligibleOccurrenceRepository: Partial<EligibleOccurrenceRepository> = { findByUserId: async () => [] },
  exchangeRepository: Partial<ExchangeRepository> = {
    findForUser: async () => ({ current: 1, hasNext: false, hasPrevious: false, data: [] }),
  },
) {
  const app = createApp({
    repositories: {
      enrollmentRepository: {
        sharesOccurrence: async () => false,
        isEnrolledInOccurrence: async () => false,
        ...enrollmentRepository,
      },
      eligibleOccurrenceRepository: {
        findByUserId: async () => [],
        ...eligibleOccurrenceRepository,
      },
      exchangeRepository: {
        findForUser: async () => ({ current: 1, hasNext: false, hasPrevious: false, data: [] }),
        ...exchangeRepository,
      },
      sessionRepository: createFakeSessions(),
    },
  })

  return { app, get: createGet(app) }
}
