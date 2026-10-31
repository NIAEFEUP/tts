import { describe, expect, it } from 'bun:test'

import type { StudentEnrollment } from '@/domain/ports/enrollment.repository'

import { TEST_USER } from '../support/auth-test-utils'
import { UNAUTHORIZED_BODY } from '../support/catalog-test-utils'
import { createUsersApp } from '../support/user-test-utils'

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
const { get } = createUsersApp({
  async findByUserId(userId) {
    queriedUserId = userId
    return enrollments
  },
})

describe('schedule routes', () => {
  it('returns the authenticated student schedule', async () => {
    const { status, contentType, body } = await get('/v1/users/me/schedule')
    const entries = body as Array<Record<string, unknown>>

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(queriedUserId).toBe(TEST_USER.id)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      classId: 678,
      className: '1LEIC01',
      occurrence: { id: 12345, year: 2025 },
    })
  })

  it('orders slots by day of the week, then start time', async () => {
    const { body } = await get('/v1/users/me/schedule')
    const entries = body as Array<{ slots: Array<{ id: number }> }>

    // (day 2, 540) → (day 2, 600) → (day 3, 540)
    expect(entries[0]?.slots.map((s) => s.id)).toEqual([3, 1, 2])
  })

  it('answers an empty list when the student has no enrollments', async () => {
    const { get: getEmpty } = createUsersApp({ findByUserId: async () => [] })
    const { status, body } = await getEmpty('/v1/users/me/schedule')

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('keeps the enrollment order and serialises locations and professors', async () => {
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
    const { get: getTwo } = createUsersApp({ findByUserId: async () => [...enrollments, second] })
    const { status, body } = await getTwo('/v1/users/me/schedule')
    const entries = body as Array<{ classId: number; slots: Array<Record<string, unknown>> }>

    expect(status).toBe(200)
    expect(entries.map((entry) => entry.classId)).toEqual([678, 700])
    expect(entries[1]?.slots[0]).toMatchObject({
      location: 'B201',
      professors: [{ id: 5, acronym: 'JP', name: 'João Pinto' }],
    })
  })

  it('rejects an anonymous caller with a 401 unauthorized', async () => {
    const { status, body } = await get('/v1/users/me/schedule', { cookie: null })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })

  it('rejects an unrecognised session cookie with a 401', async () => {
    const { status, body } = await get('/v1/users/me/schedule', { cookie: 'session=forged' })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })
})
