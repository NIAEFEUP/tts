import { describe, expect, it } from 'bun:test'

import type { AdminRepository } from '@/domain/ports/admin.repository'

import { ADMIN } from './support/auth-test-utils'
import { COURSES, OCCURRENCES, UNAUTHORIZED_BODY } from './support/catalog-test-utils'
import { createAdminApp } from './support/admin-test-utils'

const COURSES_PATH = '/v1/admin/courses'
const OCCURRENCES_PATH = '/v1/admin/occurrences'

const FORBIDDEN_BODY = { error: 'Admin access required', code: 'forbidden' }
const BD_UNIT = { acronym: 'BD', name: 'Bases de Dados', courseUnitYear: 2 }

// A repository that fails if it is reached: the 401 and 403 must stop before it.
const unreachable: AdminRepository = {
  async findCoursesByAdmin() {
    throw new Error('the repository must not be called')
  },
  async findOccurrencesByAdmin() {
    throw new Error('the repository must not be called')
  },
}

describe('GET /v1/admin/courses', () => {
  it('lists only the courses in my scope, ordered by acronym', async () => {
    const { get } = createAdminApp({
      courseScopes: {
        // MAP is listed first on purpose: the answer must still come ordered.
        [ADMIN.id]: [22990, 22841],
        // Another admin's scope must not leak into mine.
        up000000000: [22201],
      },
    })

    const { status, body } = await get(COURSES_PATH)

    expect(status).toBe(200)
    expect(body).toEqual([COURSES[0], COURSES[1]])
  })

  it('returns an empty list when I have no scope', async () => {
    const { get } = createAdminApp()
    const { status, body } = await get(COURSES_PATH)

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('does not use my occurrence scope', async () => {
    const { get } = createAdminApp({ occurrenceScopes: { [ADMIN.id]: [{ id: 587177, year: 2025 }] } })
    const { status, body } = await get(COURSES_PATH)

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('returns an empty list for a SUPERUSER with no scope rows', async () => {
    const { get } = createAdminApp({ role: 'SUPERUSER' })
    const { status, body } = await get(COURSES_PATH)

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('returns 401 without a valid session', async () => {
    const { get } = createAdminApp({ adminRepository: unreachable })

    for (const cookie of [null, 'session=invalid-session']) {
      const { status, body } = await get(COURSES_PATH, { cookie })

      expect(status).toBe(401)
      expect(body).toEqual(UNAUTHORIZED_BODY)
    }
  })

  it('returns 403 for a plain USER', async () => {
    const { get } = createAdminApp({ role: 'USER', adminRepository: unreachable })
    const { status, body } = await get(COURSES_PATH)

    expect(status).toBe(403)
    expect(body).toEqual(FORBIDDEN_BODY)
  })
})

describe('GET /v1/admin/occurrences', () => {
  it('lists only the occurrences in my scope, with the course unit data, newest year first', async () => {
    const { get } = createAdminApp({
      occurrenceScopes: {
        // 2024 is listed first on purpose: the answer must still come newest first.
        [ADMIN.id]: [
          { id: 587178, year: 2024 },
          { id: 587177, year: 2025 },
        ],
        up000000000: [{ id: 587179, year: 2025 }],
      },
    })

    const { status, body } = await get(OCCURRENCES_PATH)

    expect(status).toBe(200)
    expect(body).toEqual([
      { ...OCCURRENCES[0], ...BD_UNIT },
      { ...OCCURRENCES[1], ...BD_UNIT },
    ])
  })

  it('matches the (id, year) pair, not the id alone', async () => {
    // Same id in two years: only the year in my scope may come back.
    const sameIdOtherYear = { ...OCCURRENCES[0]!, year: 2024 }
    const { get } = createAdminApp({
      occurrences: [OCCURRENCES[0]!, sameIdOtherYear],
      occurrenceScopes: { [ADMIN.id]: [{ id: 587177, year: 2025 }] },
    })

    const { status, body } = await get(OCCURRENCES_PATH)

    expect(status).toBe(200)
    expect(body).toEqual([{ ...OCCURRENCES[0], ...BD_UNIT }])
  })

  it('returns an empty list when I have no scope', async () => {
    const { get } = createAdminApp()
    const { status, body } = await get(OCCURRENCES_PATH)

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('does not grant the occurrences of a course I administer', async () => {
    // I am admin of course 22841, which has occurrences, but have no
    // AdminOccurrence row: the list stays empty.
    const { get } = createAdminApp({ courseScopes: { [ADMIN.id]: [22841] } })
    const { status, body } = await get(OCCURRENCES_PATH)

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('returns 401 without a valid session', async () => {
    const { get } = createAdminApp({ adminRepository: unreachable })

    for (const cookie of [null, 'session=invalid-session']) {
      const { status, body } = await get(OCCURRENCES_PATH, { cookie })

      expect(status).toBe(401)
      expect(body).toEqual(UNAUTHORIZED_BODY)
    }
  })

  it('returns 403 for a plain USER', async () => {
    const { get } = createAdminApp({ role: 'USER', adminRepository: unreachable })
    const { status, body } = await get(OCCURRENCES_PATH)

    expect(status).toBe(403)
    expect(body).toEqual(FORBIDDEN_BODY)
  })
})
