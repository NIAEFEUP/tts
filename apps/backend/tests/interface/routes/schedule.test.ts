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

const slot = (id: number, dayOfWeek: number, startMinute: number) => ({
  id,
  lessonType: 'TP',
  dayOfWeek,
  startMinute,
  durationMin: 120,
  location: null,
  professors: [],
})

// slots deliberately out of order: the use case has to sort them
const enrollments: StudentEnrollment[] = [
  {
    occurrence: {
      id: 12345,
      year: 2025,
      courseUnit: { id: 42, acronym: 'BD', name: 'Bases de Dados', semester: 1 },
    },
    class: {
      id: 678,
      name: '1LEIC01',
      vacancies: 25,
      slots: [slot(1, 2, 600), slot(2, 3, 540), slot(3, 2, 540)],
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

const app = createApp({ repositories: { enrollmentRepository, sessionRepository } })

const getSchedule = (cookie?: string, target = app) =>
  target.handle(
    new Request('http://localhost/v1/users/me/schedule', {
      headers: cookie ? { cookie } : {},
    }),
  )

it('GET /users/me/schedule returns the authenticated student schedule', async () => {
  const response = await getSchedule('session=valid-session')
  const body = (await response.json()) as Array<Record<string, unknown>>

  expect(response.status).toBe(200)
  expect(queriedUserId).toBe(USER.id)
  expect(body).toHaveLength(1)
  expect(body[0]).toMatchObject({
    classId: 678,
    className: '1LEIC01',
    occurrence: { id: 12345, year: 2025 },
  })
})

it('GET /users/me/schedule orders slots by day of the week, then start time', async () => {
  const response = await getSchedule('session=valid-session')
  const body = (await response.json()) as Array<{ slots: Array<{ id: number }> }>

  // (day 2, 540) → (day 2, 600) → (day 3, 540)
  expect(body[0]?.slots.map((s) => s.id)).toEqual([3, 1, 2])
})

it('GET /users/me/schedule returns an empty list when the student has no enrollments', async () => {
  const emptyApp = createApp({
    repositories: { enrollmentRepository: { findByUserId: async () => [] }, sessionRepository },
  })
  const response = await getSchedule('session=valid-session', emptyApp)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual([])
})

it('GET /users/me/schedule requires a valid session cookie', async () => {
  for (const cookie of [undefined, 'session=invalid-session']) {
    const response = await getSchedule(cookie)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Authentication required', code: 'unauthorized' })
  }
})

it('GET /users/me/schedule keeps the enrollment order and serialises locations and professors', async () => {
  const second: StudentEnrollment = {
    occurrence: {
      id: 99,
      year: 2025,
      courseUnit: { id: 7, acronym: 'PROG', name: 'Programação', semester: 1 },
    },
    class: {
      id: 700,
      name: '1LEIC02',
      vacancies: null,
      slots: [{ ...slot(10, 1, 480), location: 'B201', professors: [{ id: 5, acronym: 'JP', name: 'João Pinto' }] }],
    },
  }
  const twoClassesApp = createApp({
    repositories: {
      enrollmentRepository: { findByUserId: async () => [...enrollments, second] },
      sessionRepository,
    },
  })

  const response = await getSchedule('session=valid-session', twoClassesApp)
  const body = (await response.json()) as Array<{ classId: number; slots: Array<Record<string, unknown>> }>

  expect(response.status).toBe(200)
  expect(body.map((entry) => entry.classId)).toEqual([678, 700])
  expect(body[1]?.slots[0]).toMatchObject({
    location: 'B201',
    professors: [{ id: 5, acronym: 'JP', name: 'João Pinto' }],
  })
})
