import { describe, expect, it } from 'bun:test'

import { UNAUTHORIZED_BODY } from '../support/catalog-test-utils'
import { CLASSMATE, STRANGER, createStudentsApp, studentNotFoundBody } from '../support/user-test-utils'

const { get } = createStudentsApp()

describe('student profile route', () => {
  it('returns only the name of any student to any signed-in user', async () => {
    const { status, contentType, body } = await get(`/v1/students/${STRANGER.id}`)

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual({ name: STRANGER.name })
  })

  it('resolves the up-prefixed form to the same student', async () => {
    const { status, body } = await get(`/v1/students/up${CLASSMATE.id}`)

    expect(status).toBe(200)
    expect(body).toEqual({ name: CLASSMATE.name })
  })

  it('answers 404 student-not-found for an unknown student', async () => {
    const { status, body } = await get('/v1/students/202099999')

    expect(status).toBe(404)
    expect(body).toEqual(studentNotFoundBody('202099999'))
  })

  it('answers 404 for a malformed nmec', async () => {
    const { status, body } = await get('/v1/students/not-a-student')

    expect(status).toBe(404)
    expect(body).toEqual(studentNotFoundBody('not-a-student'))
  })

  it('rejects an anonymous caller with a 401', async () => {
    const { status, body } = await get(`/v1/students/${CLASSMATE.id}`, { cookie: null })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })

  it('rejects an unrecognised session cookie with a 401', async () => {
    const { status, body } = await get(`/v1/students/${CLASSMATE.id}`, { cookie: 'session=forged' })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })
})
