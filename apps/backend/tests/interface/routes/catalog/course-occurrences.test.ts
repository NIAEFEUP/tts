import { describe, expect, it } from 'bun:test'

import {
  CLASSES,
  COURSE_UNITS,
  OCCURRENCES,
  EXCHANGE_PERIODS,
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
  registerCatalogAuthGuard(app, [
    '/v1/courses/22841/occurrences',
    '/v1/occurrences/587177?year=2025',
    '/v1/occurrences/587177/classes?year=2025',
    '/v1/occurrences/587177/periods?year=2025',
  ])

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

  it('returns an occurrence with its classes, schedule slots, and professors', async () => {
    const { status, contentType, body } = await get('/v1/occurrences/587177/classes?year=2025')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual({
      ...OCCURRENCES[0],
      acronym: COURSE_UNITS[0].acronym,
      name: COURSE_UNITS[0].name,
      classes: [
        {
          id: CLASSES[0].id,
          name: CLASSES[0].name,
          vacancies: CLASSES[0].vacancies,
          filteredTeachers: CLASSES[0].filteredTeachers,
          slots: CLASSES[0].slots,
        },
      ],
    })
  })

  it('looks up classes for the requested year, not a fixed one', async () => {
    // Occurrence ids repeat across years, so (id, year) is the real key. Give
    // occurrence 587177 a 2024 sibling with its own class: a handler that
    // hard-coded 2025, or dropped query.year, would return the wrong classes.
    const { get: getAcrossYears } = createCatalogApp({
      occurrences: [OCCURRENCES[0], { ...OCCURRENCES[0], year: 2024, hash: 'hash-bd-2024' }],
    })

    const in2024 = await getAcrossYears('/v1/occurrences/587177/classes?year=2024')
    const in2025 = await getAcrossYears('/v1/occurrences/587177/classes?year=2025')

    expect(in2024.status).toBe(200)
    expect(in2024.body).toMatchObject({ year: 2024, classes: [{ id: 503 }] })
    expect(in2025.body).toMatchObject({ year: 2025, classes: [{ id: 501 }] })
  })

  it('returns an empty class list for an occurrence with no classes', async () => {
    const { status, body } = await get('/v1/occurrences/587178/classes?year=2024')

    expect(status).toBe(200)
    expect(body).toMatchObject({ classes: [] })
  })

  it('returns 404 when the occurrence does not exist for the requested year', async () => {
    const { status, body } = await get('/v1/occurrences/587177/classes?year=2020')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Occurrence 587177 not found', code: 'occurrence-not-found' })
  })
})

// --- GET /v1/occurrences/:id/periods ---

it('an occurrence lists its exchange periods ordered by startsAt', async () => {
  const { status, contentType, body } = await get('/v1/occurrences/587177/periods?year=2025')

  expect(status).toBe(200)
  expect(contentType).toMatch(/^application\/json/)
  // The fixture is out of order on purpose; Dates serialize to ISO strings.
  expect(body).toEqual([
    { ...EXCHANGE_PERIODS[1], startsAt: '2025-09-01T00:00:00.000Z', endsAt: '2025-09-15T00:00:00.000Z' },
    { ...EXCHANGE_PERIODS[0], startsAt: '2026-02-01T00:00:00.000Z', endsAt: '2026-02-15T00:00:00.000Z' },
  ])
})

it('only the periods of the requested (id, year) are returned', async () => {
  // 587177 also has a period in 2024; it must not leak into 2025.
  const { body } = await get('/v1/occurrences/587177/periods?year=2025')

  expect(body).toHaveLength(2)
})

it('an occurrence with no periods answers an empty list, not an error', async () => {
  // 587179/2025 exists but has no entries in EXCHANGE_PERIODS.
  const { status, body } = await get('/v1/occurrences/587179/periods?year=2025')

  expect(status).toBe(200)
  expect(body).toEqual([])
})

it('an unknown occurrence answers 404 occurrence-not-found', async () => {
  const { status, body } = await get('/v1/occurrences/99999/periods?year=2025')

  expect(status).toBe(404)
  expect(body).toEqual({ error: 'Occurrence 99999 not found', code: 'occurrence-not-found' })
})

it('the same occurrence id with a different year answers 404', async () => {
  const { status, body } = await get('/v1/occurrences/587177/periods?year=2020')

  expect(status).toBe(404)
  expect(body).toEqual({ error: 'Occurrence 587177 not found', code: 'occurrence-not-found' })
})

it('omitting year is rejected by the query schema', async () => {
  const { status, body } = await get('/v1/occurrences/587177/periods')

  expect(status).toBe(422)
  expect(body).toEqual(VALIDATION_ERROR_BODY)
})

it('a non-numeric occurrence id is rejected by the params schema', async () => {
  const { status, body } = await get('/v1/occurrences/not-a-number/periods?year=2025')

  expect(status).toBe(422)
  expect(body).toEqual(VALIDATION_ERROR_BODY)
})
