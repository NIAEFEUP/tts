import { describe, expect, it } from 'bun:test'

import {
  COURSES,
  VALIDATION_ERROR_BODY,
  createCatalogApp,
  registerCatalogAuthGuard,
} from '../support/catalog-test-utils'

// The fake repositories, fixtures, and `get` helper live in
// `catalog-test-utils`, shared with the other catalog route tests.

const { app, get } = createCatalogApp()

describe('courses routes', () => {
  registerCatalogAuthGuard(app, ['/v1/courses', '/v1/courses/22841'])

  it('every course is listed with the faculties that offer it', async () => {
    const { status, contentType, body } = await get('/v1/courses')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual(COURSES)
  })

  it('the year query param filters the courses', async () => {
    const current = await get('/v1/courses?year=2025')
    const previous = await get('/v1/courses?year=2024')

    expect(current.body).toEqual([COURSES[0], COURSES[1]])
    expect(previous.body).toEqual([COURSES[2]])
  })

  it('the faculty query param filters the courses', async () => {
    const fcup = await get('/v1/courses?faculty=FCUP')

    expect(fcup.body).toEqual([COURSES[1]])
  })

  it('the year and faculty filters combine', async () => {
    const { status, body } = await get('/v1/courses?year=2024&faculty=FEUP')

    expect(status).toBe(200)
    expect(body).toEqual([COURSES[2]])
  })

  it('an unknown faculty answers an empty list, not an error', async () => {
    const { status, body } = await get('/v1/courses?faculty=NOPE')

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('a course is returned by its id', async () => {
    const { status, body } = await get('/v1/courses/22841')

    expect(status).toBe(200)
    expect(body).toEqual(COURSES[0])
  })

  it('an unknown course id answers 404 course-not-found instead of null', async () => {
    const { status, body } = await get('/v1/courses/99999')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Course 99999 not found', code: 'course-not-found' })
  })

  it('a non-numeric course id is rejected by the params schema, not the handler', async () => {
    const { status, body } = await get('/v1/courses/not-a-number')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('a non-numeric year is rejected by the query schema', async () => {
    const { status, body } = await get('/v1/courses?year=feup')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })
})
