import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import { createApp } from '@/main'

import { TEST_SESSION_TOKEN, createFakeSessions } from './auth-test-utils'

// Shared harness for the `/v1/users/me/*` route tests. Like `catalog-test-utils`,
// it drives the real app through `app.handle(request)` with fake repositories:
// no listener and no database. `student-test-utils` builds on `createGet`.

type GetOptions = {
  /** Cookie header to send. Defaults to the signed-in test session; `null` sends none. */
  cookie?: string | null
}

/** A `get(path)` bound to `app`, signed in as the test session unless told otherwise. */
export function createGet(app: ReturnType<typeof createApp>) {
  return async (path: string, { cookie = `session=${TEST_SESSION_TOKEN}` }: GetOptions = {}) => {
    const response = await app.handle(new Request(`http://localhost${path}`, { headers: cookie ? { cookie } : {} }))
    const contentType = response.headers.get('content-type')

    return {
      status: response.status,
      contentType,
      location: response.headers.get('location'),
      // Redirects have no body, so only parse what says it is JSON.
      body: contentType?.startsWith('application/json') ? ((await response.json()) as unknown) : null,
    }
  }
}

/**
 * `enrollmentRepository` only needs `findByUserId`; `sharesOccurrence` defaults
 * to "no", for the `/users/me/*` tests that never reach it.
 */
export function createUsersApp(
  enrollmentRepository: Pick<EnrollmentRepository, 'findByUserId'> & Partial<EnrollmentRepository>,
) {
  const app = createApp({
    repositories: {
      enrollmentRepository: { sharesOccurrence: async () => false, ...enrollmentRepository },
      sessionRepository: createFakeSessions(),
    },
  })

  return { app, get: createGet(app) }
}
