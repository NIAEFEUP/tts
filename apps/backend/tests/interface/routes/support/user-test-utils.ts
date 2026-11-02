import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import { createApp } from '@/main'

import { TEST_SESSION_TOKEN, createFakeSessions } from './auth-test-utils'

// Shared harness for the `/v1/users/me/*` route tests. Like `catalog-test-utils`,
// it drives the real app through `app.handle(request)` with fake repositories:
// no listener and no database.

type GetOptions = {
  /** Cookie header to send. Defaults to the signed-in test session; `null` sends none. */
  cookie?: string | null
}

export function createUsersApp(enrollmentRepository: EnrollmentRepository) {
  const app = createApp({
    repositories: { enrollmentRepository, sessionRepository: createFakeSessions() },
  })

  const get = async (path: string, { cookie = `session=${TEST_SESSION_TOKEN}` }: GetOptions = {}) => {
    const response = await app.handle(new Request(`http://localhost${path}`, { headers: cookie ? { cookie } : {} }))

    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
      body: (await response.json()) as unknown,
    }
  }

  return { app, get }
}
