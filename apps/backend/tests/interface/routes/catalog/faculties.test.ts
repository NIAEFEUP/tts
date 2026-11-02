import { describe, expect, it } from 'bun:test'

import {
  COURSES,
  FACULTIES,
  VALIDATION_ERROR_BODY,
  createCatalogApp,
  registerCatalogAuthGuard,
} from '../support/catalog-test-utils'

// The fake repositories, fixtures, and `get` helper live in
// `catalog-test-utils`, shared with the other catalog route tests.

const { app, get } = createCatalogApp()

describe('faculties routes', () => {
  registerCatalogAuthGuard(app, ['/v1/faculties'])

  it('every faculty is listed', async () => {
    const { status, contentType, body } = await get('/v1/faculties')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual(FACULTIES)
  })

  it('a faculty is returned by its acronym', async () => {
    const { status, body } = await get('/v1/faculties/FEUP')

    expect(status).toBe(200)
    expect(body).toEqual({ acronym: 'FEUP', name: 'Faculdade de Engenharia' })
  })

  it('an unknown acronym answers 404 faculty-not-found instead of null', async () => {
    const { status, body } = await get('/v1/faculties/NOPE')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Faculty NOPE not found', code: 'faculty-not-found' })
  })

  it('courses of a faculty carry every faculty that offers them', async () => {
    const { status, body } = await get('/v1/faculties/FCUP/courses')

    expect(status).toBe(200)
    expect(body).toEqual([COURSES[1]])
  })

  it('the year query param filters the courses', async () => {
    const current = await get('/v1/faculties/FEUP/courses?year=2025')
    const previous = await get('/v1/faculties/FEUP/courses?year=2024')

    expect(current.body).toEqual([COURSES[0], COURSES[1]])
    expect(previous.body).toEqual([COURSES[2]])
  })

  it('a faculty with no courses for that year answers an empty list, not an error', async () => {
    const { status, body } = await get('/v1/faculties/FEUP/courses?year=2019')

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('courses of an unknown faculty answer the same 404 as the faculty route', async () => {
    const { status, body } = await get('/v1/faculties/NOPE/courses')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Faculty NOPE not found', code: 'faculty-not-found' })
  })

  it('a non-numeric year is rejected by the query schema, not the handler', async () => {
    const { status, body } = await get('/v1/faculties/FEUP/courses?year=feup')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('a non-integer year is rejected by the query schema', async () => {
    const { status, body } = await get('/v1/faculties/FEUP/courses?year=2025.5')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })
})
