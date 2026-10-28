import { expect, it } from 'bun:test'

import type { AuthUser } from '@/core/auth/user'
import type { EnrollmentRepository, StudentEnrollment } from '@/domain/ports/enrollment.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createApp } from '@/main'

const USER: AuthUser = {
  id: 'up202012345',
  name: 'Ana Silva',
  email: 'up202012345@up.pt',
  role: 'USER',
}

const enrollments: StudentEnrollment[] = [
  {
    occurrence: {
      id: 12345,
      year: 2025,
      courseUnit: {
        id: 42,
        acronym: 'BD',
        name: 'Bases de Dados',
        semester: 1,
      },
    },
    class: {
      id: 678,
      name: '1LEIC01',
      vacancies: 25,
      slots: [
        {
          id: 901,
          lessonType: 'TP',
          dayOfWeek: 2,
          startMinute: 540,
          durationMin: 120,
          location: 'B108',
          professors: [{ id: 123, acronym: 'AS', name: 'Ana Silva' }],
        },
      ],
    },
  },
]

let queriedUserId: string | null = null

const enrollmentRepository: EnrollmentRepository = {
  async findByUserId(userId) {
    queriedUserId = userId
    return enrollments
  },
}

const sessionRepository: SessionRepository = {
  issue: async () => 'valid-session',
  resolve: async (token) => (token === 'valid-session' ? USER : null),
  revoke: async () => {},
}

const app = createApp({
  repositories: {
    enrollmentRepository,
    sessionRepository,
  },
})

const getEnrollments = (cookie?: string) =>
  app.handle(
    new Request('http://localhost/v1/users/me/enrollments', {
      headers: cookie ? { cookie } : {},
    }),
  )

it('GET /users/me/enrollments returns the authenticated student enrollment details', async () => {
  const response = await getEnrollments('session=valid-session')

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(enrollments)
  expect(queriedUserId).toBe(USER.id)
})

it('GET /users/me/enrollments returns an empty list when the student has no enrollments', async () => {
  const emptyApp = createApp({
    repositories: {
      enrollmentRepository: { findByUserId: async () => [] },
      sessionRepository,
    },
  })
  const response = await emptyApp.handle(
    new Request('http://localhost/v1/users/me/enrollments', {
      headers: { cookie: 'session=valid-session' },
    }),
  )

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual([])
})

it('GET /users/me/enrollments requires a valid session cookie', async () => {
  for (const cookie of [undefined, 'session=invalid-session']) {
    const response = await getEnrollments(cookie)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: 'Authentication required',
      code: 'unauthorized',
    })
  }
})
