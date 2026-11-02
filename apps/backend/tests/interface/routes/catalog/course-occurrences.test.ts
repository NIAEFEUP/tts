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
// The two endpoints below are one feature — "view course occurrences" — so
// they live in one suite even though they are served by different prefixes
// (`/v1/courses/:id/occurrences` and `/v1/occurrences/:id`).

const { app, get } = createCatalogApp()

describe('occurrence routes', () => {
  registerCatalogAuthGuard(app, ['/v1/courses/22841/occurrences', '/v1/occurrences/587177?year=2025'])

  // --- GET /v1/courses/:id/occurrences ---

  it('a course lists all its occurrences when no filters are given', async () => {
    const { status, contentType, body } = await get('/v1/courses/22841/occurrences')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    // Course 22841 has two occurrences (units 42 and 43, both year 2025).
    // Sorted newest year first, then by id ascending.
    expect(body).toEqual([OCCURRENCES[0], OCCURRENCES[2]])
  })

  it('the year query param filters the occurrences', async () => {
    const { status, body } = await get('/v1/courses/22841/occurrences?year=2025')

    expect(status).toBe(200)
    expect(body).toEqual([OCCURRENCES[0], OCCURRENCES[2]])
  })

  it('a year with no matching occurrences answers an empty list, not an error', async () => {
    const { status, body } = await get('/v1/courses/22841/occurrences?year=2020')

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('the semester query param filters the occurrences', async () => {
    // Semester lives on CourseUnit, not Occurrence — the fake joins in memory.
    // Unit 42 (BD) is semester 1; unit 43 (COMP) is semester 2.
    const sem1 = await get('/v1/courses/22841/occurrences?semester=1')
    const sem2 = await get('/v1/courses/22841/occurrences?semester=2')

    expect(sem1.body).toEqual([OCCURRENCES[0]])
    expect(sem2.body).toEqual([OCCURRENCES[2]])
  })

  it('the year and semester filters combine', async () => {
    const { status, body } = await get('/v1/courses/22841/occurrences?year=2025&semester=2')

    expect(status).toBe(200)
    expect(body).toEqual([OCCURRENCES[2]])
  })

  it('a course with no occurrences answers an empty list, not an error', async () => {
    // Course 22201 exists but has no course units and therefore no occurrences.
    const { status, body } = await get('/v1/courses/22201/occurrences')

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('an unknown course id answers 404 course-not-found', async () => {
    const { status, body } = await get('/v1/courses/99999/occurrences')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Course 99999 not found', code: 'course-not-found' })
  })

  it('a non-numeric course id is rejected by the params schema, not the handler', async () => {
    const { status, body } = await get('/v1/courses/not-a-number/occurrences')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('a semester outside {1, 2} is rejected by the query schema', async () => {
    const { status, body } = await get('/v1/courses/22841/occurrences?semester=3')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  // --- GET /v1/occurrences/:id ---

  it('an occurrence is returned by its composite key (id, year) with its course unit fields', async () => {
    const { status, contentType, body } = await get('/v1/occurrences/587177?year=2025')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    // The response enriches the bare occurrence with the course unit's name and
    // acronym so the client does not need a second round-trip.
    expect(body).toEqual({
      ...OCCURRENCES[0],
      acronym: COURSE_UNITS[0].acronym,
      name: COURSE_UNITS[0].name,
    })
  })

  it('the same occurrence id with a different year answers 404', async () => {
    // Sigarra reuses occurrence ids across years — (id, year) is the real key.
    const { status, body } = await get('/v1/occurrences/587177?year=2020')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Occurrence 587177 not found', code: 'occurrence-not-found' })
  })

  it('an unknown occurrence id answers 404 occurrence-not-found', async () => {
    const { status, body } = await get('/v1/occurrences/99999?year=2025')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Occurrence 99999 not found', code: 'occurrence-not-found' })
  })

  it('a non-numeric occurrence id is rejected by the params schema, not the handler', async () => {
    const { status, body } = await get('/v1/occurrences/not-a-number?year=2025')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('omitting year is rejected by the query schema because year is required', async () => {
    // `year` is required for /occurrences/:id — without it the composite PK
    // cannot be resolved and the endpoint would be ambiguous.
    const { status, body } = await get('/v1/occurrences/587177')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('a non-numeric year is rejected by the query schema', async () => {
    const { status, body } = await get('/v1/occurrences/587177?year=abc')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })
})
