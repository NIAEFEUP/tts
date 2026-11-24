import { describe, expect, it } from 'bun:test'

import { ADMIN } from '../support/auth-test-utils'
import {
  VALIDATION_ERROR_BODY,
  createCatalogApp,
  registerAdminGuard,
  registerCatalogAuthGuard,
} from '../support/catalog-test-utils'

const NEW_RANGE = { startsAt: '2027-03-01T00:00:00.000Z', endsAt: '2027-03-15T00:00:00.000Z' }
const OVERLAPPING_RANGE = { startsAt: '2025-09-05T00:00:00.000Z', endsAt: '2025-09-10T00:00:00.000Z' }

const OCCURRENCE_PATH = '/v1/occurrences/587177/periods?year=2025'
const PERIOD_PATH = '/v1/occurrences/587177/periods/period-587177-2025-02'
const COURSE_PATH = '/v1/courses/22841/periods'

function scopedApp() {
  return createCatalogApp({
    user: ADMIN,
    courseScopes: { [ADMIN.id]: [22841] },
    occurrenceScopes: { [ADMIN.id]: [{ id: 587177, year: 2025 }] },
  })
}

describe('exchange period mutations', () => {
  const unauthenticated = createCatalogApp()
  registerCatalogAuthGuard(unauthenticated.app, [
    { method: 'POST', path: OCCURRENCE_PATH, body: NEW_RANGE },
    { method: 'PUT', path: PERIOD_PATH, body: NEW_RANGE },
    { method: 'DELETE', path: PERIOD_PATH },
    { method: 'POST', path: COURSE_PATH, body: NEW_RANGE },
    { method: 'POST', path: '/v1/occurrences/587177/periods' },
  ])
  registerAdminGuard(unauthenticated.app, [
    { method: 'POST', path: OCCURRENCE_PATH, body: NEW_RANGE },
    { method: 'PUT', path: PERIOD_PATH, body: NEW_RANGE },
    { method: 'DELETE', path: PERIOD_PATH },
    { method: 'POST', path: COURSE_PATH, body: NEW_RANGE },
  ])

  it('rejects an admin without scope with a 403', async () => {
    const { post } = createCatalogApp({ user: ADMIN })

    const occurrence = await post(OCCURRENCE_PATH, { body: NEW_RANGE })
    const course = await post(COURSE_PATH, { body: NEW_RANGE })

    expect(occurrence.status).toBe(403)
    expect(course.status).toBe(403)
  })

  it('creates a period for the requested occurrence year', async () => {
    const { post, get } = scopedApp()

    const { status, contentType, body } = await post(OCCURRENCE_PATH, { body: NEW_RANGE })
    expect(status).toBe(201)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toMatchObject({ occurrenceId: 587177, occurrenceYear: 2025, ...NEW_RANGE })

    const listed = await get(OCCURRENCE_PATH)
    expect((listed.body as { startsAt: string }[]).some((period) => period.startsAt === NEW_RANGE.startsAt)).toBe(true)
  })

  it('does not create a period for another year with the same occurrence id', async () => {
    const { post } = scopedApp()

    const { status, body } = await post('/v1/occurrences/587177/periods?year=2024', { body: NEW_RANGE })

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Occurrence 587177 not found', code: 'occurrence-not-found' })
  })

  it('requires the year query parameter when creating a period', async () => {
    const { post } = scopedApp()

    const { status, body } = await post('/v1/occurrences/587177/periods', { body: NEW_RANGE })

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('rejects an invalid period range', async () => {
    const { post } = scopedApp()

    const { status, body } = await post(OCCURRENCE_PATH, {
      body: { startsAt: NEW_RANGE.endsAt, endsAt: NEW_RANGE.startsAt },
    })

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'startsAt must be before endsAt', code: 'invalid-period-range' })
  })

  it('rejects an overlapping period', async () => {
    const { post } = scopedApp()

    const { status, body } = await post(OCCURRENCE_PATH, { body: OVERLAPPING_RANGE })

    expect(status).toBe(409)
    expect(body).toMatchObject({ code: 'exchange-period-overlap' })
  })

  it('updates a period by resolving its year from the period id', async () => {
    const { put } = scopedApp()

    const { status, contentType, body } = await put(PERIOD_PATH, { body: NEW_RANGE })

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toMatchObject({ id: 'period-587177-2025-02', occurrenceYear: 2025, ...NEW_RANGE })
  })

  it('rejects a period id belonging to another occurrence', async () => {
    const { put, del } = scopedApp()

    const update = await put('/v1/occurrences/587177/periods/period-587179-2025-09', { body: NEW_RANGE })
    const removal = await del('/v1/occurrences/587177/periods/period-587179-2025-09')

    expect(update.status).toBe(404)
    expect(update.body).toMatchObject({ code: 'exchange-period-not-found' })
    expect(removal.status).toBe(404)
    expect(removal.body).toMatchObject({ code: 'exchange-period-not-found' })
  })

  it('deletes a period', async () => {
    const { del, get } = scopedApp()

    const { status } = await del(PERIOD_PATH)
    expect(status).toBe(204)

    const listed = await get(OCCURRENCE_PATH)
    expect((listed.body as { id: string }[]).some((period) => period.id === 'period-587177-2025-02')).toBe(false)
  })

  it('opens one period per occurrence of a course', async () => {
    const { post, get } = scopedApp()

    const { status, contentType, body } = await post(COURSE_PATH, { body: NEW_RANGE })
    expect(status).toBe(201)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toMatchObject([
      { occurrenceId: 587177, occurrenceYear: 2025, ...NEW_RANGE },
      { occurrenceId: 587179, occurrenceYear: 2025, ...NEW_RANGE },
    ])

    const listed = await get(COURSE_PATH)
    expect(listed.body).toContainEqual({
      id: (body as { id: string }[])[0]!.id,
      startsAt: NEW_RANGE.startsAt,
      endsAt: NEW_RANGE.endsAt,
    })
  })

  it('rejects a course period that overlaps an existing window', async () => {
    const { post } = scopedApp()

    const { status, body } = await post(COURSE_PATH, { body: OVERLAPPING_RANGE })

    expect(status).toBe(409)
    expect(body).toMatchObject({ code: 'exchange-period-overlap' })
  })

  it('rejects an unknown course', async () => {
    const { post } = scopedApp()

    const { status, body } = await post('/v1/courses/99999/periods', { body: NEW_RANGE })

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Course 99999 not found', code: 'course-not-found' })
  })
})
