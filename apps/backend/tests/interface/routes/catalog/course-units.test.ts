import { describe, expect, it } from 'bun:test'

import {
  COURSE_UNITS,
  OCCURRENCES,
  VALIDATION_ERROR_BODY,
  createCatalogApp,
  registerCatalogAuthGuard,
} from '../support/catalog-test-utils'

// The fake repositories, fixtures, and `get` helper live in
// `catalog-test-utils`, shared with the other catalog route tests.
//
// The three endpoints below are one feature — "view the course units of a
// course" — so they live in one suite even though the first is served by
// `courses.routes.ts` and the other two by `course-units.routes.ts`.

const { app, get } = createCatalogApp()

describe('course-units routes', () => {
  registerCatalogAuthGuard(app, ['/v1/courses/22841/units', '/v1/course-units/42', '/v1/course-units/42/occurrences'])

  it('a course lists the course units it offers', async () => {
    const { status, contentType, body } = await get('/v1/courses/22841/units')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual([COURSE_UNITS[0], COURSE_UNITS[1]])
  })

  it('a course without course units answers an empty list, not an error', async () => {
    const { status, body } = await get('/v1/courses/22201/units')

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('an unknown course id answers 404 course-not-found', async () => {
    const { status, body } = await get('/v1/courses/99999/units')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Course 99999 not found', code: 'course-not-found' })
  })

  it('a non-numeric course id is rejected by the params schema, not the handler', async () => {
    const { status, body } = await get('/v1/courses/not-a-number/units')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('a course unit is returned by its id', async () => {
    const { status, contentType, body } = await get('/v1/course-units/42')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual(COURSE_UNITS[0])
  })

  it('an unknown course unit id answers 404 course-unit-not-found', async () => {
    const { status, body } = await get('/v1/course-units/99999')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Course unit 99999 not found', code: 'course-unit-not-found' })
  })

  it('a non-numeric course unit id is rejected by the params schema, not the handler', async () => {
    const { status, body } = await get('/v1/course-units/not-a-number')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('a course unit lists its occurrences across courses and academic years', async () => {
    const { status, contentType, body } = await get('/v1/course-units/42/occurrences')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual([OCCURRENCES[0], OCCURRENCES[1]])
  })

  it('a course unit without occurrences answers an empty list, not an error', async () => {
    const { status, body } = await get('/v1/course-units/44/occurrences')

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('an unknown course unit id answers 404 course-unit-not-found for its occurrences', async () => {
    const { status, body } = await get('/v1/course-units/99999/occurrences')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Course unit 99999 not found', code: 'course-unit-not-found' })
  })
})
