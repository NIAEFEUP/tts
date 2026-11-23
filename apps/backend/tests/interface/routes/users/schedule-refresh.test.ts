import { describe, expect, it } from 'bun:test'

import type { ScheduleEnrollment } from '@/domain/ports/schedule-sync'
import { createApp } from '@/main'
import { createFakeSessions, TEST_USER } from '../support/auth-test-utils'
import { UNAUTHORIZED_BODY } from '../support/catalog-test-utils'
import { request } from '../support/http-test-utils'

const latest: ScheduleEnrollment[] = [{ occurrenceId: 12345, occurrenceYear: 2026, className: '1LEIC01' }]

describe('schedule refresh route', () => {
  it('requires a valid session', async () => {
    let fetches = 0
    const app = createApp({
      scheduleSync: {
        fetchEnrollments: async () => {
          fetches++
          return latest
        },
      },
      repositories: {
        sessionRepository: createFakeSessions(),
      },
    })

    const response = await request(app, '/v1/users/me/schedule/refresh', {
      method: 'PUT',
      cookie: null,
    })

    expect(response.status).toBe(401)
    expect(response.body).toEqual(UNAUTHORIZED_BODY)
    expect(fetches).toBe(0)
  })

  it('fetches and replaces enrollments for the authenticated user, twice safely', async () => {
    const fetchedUserIds: string[] = []
    const replaced: Array<{ userId: string; enrollments: ScheduleEnrollment[] }> = []

    const app = createApp({
      scheduleSync: {
        fetchEnrollments: async (userId) => {
          fetchedUserIds.push(userId)
          return latest
        },
      },
      repositories: {
        sessionRepository: createFakeSessions(),
        enrollmentRepository: {
          findByUserId: async () => [],
          sharesOccurrence: async () => false,
          isEnrolledInOccurrence: async () => false,
          replaceForUser: async (userId, enrollments) => {
            replaced.push({ userId, enrollments })
          },
        },
      },
    })

    for (let call = 0; call < 2; call++) {
      const response = await request(app, '/v1/users/me/schedule/refresh', { method: 'PUT' })
      expect(response.status).toBe(200)
      expect(response.body).toEqual({ refreshed: true, enrollmentCount: 1 })
    }

    expect(fetchedUserIds).toEqual([TEST_USER.id, TEST_USER.id])
    expect(replaced).toEqual([
      { userId: TEST_USER.id, enrollments: latest },
      { userId: TEST_USER.id, enrollments: latest },
    ])
  })
})
