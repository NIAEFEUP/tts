import { describe, expect, it } from 'bun:test'

import { UNAUTHORIZED_BODY } from '../support/catalog-test-utils'
import { CLASSMATE, createStudentsApp, studentNotFoundBody } from '../support/user-test-utils'

const { get } = createStudentsApp()

const photoUrl = (nmec: string) => `https://sigarra.up.pt/feup/pt/fotografias_service.foto?pct_cod=${nmec}`

describe('student photo route', () => {
  it('redirects any signed-in user to the Sigarra photo', async () => {
    const { status, location, body } = await get(`/v1/students/${CLASSMATE.id}/photo`)

    expect(status).toBe(302)
    expect(location).toBe(photoUrl(CLASSMATE.id))
    expect(body).toBeNull()
  })

  it('redirects the up-prefixed form to the bare-digits photo', async () => {
    const { status, location } = await get(`/v1/students/up${CLASSMATE.id}/photo`)

    expect(status).toBe(302)
    expect(location).toBe(photoUrl(CLASSMATE.id))
  })

  it('answers 404 student-not-found for an unknown student', async () => {
    const { status, body } = await get('/v1/students/202099999/photo')

    expect(status).toBe(404)
    expect(body).toEqual(studentNotFoundBody('202099999'))
  })

  it('rejects an anonymous caller with a 401', async () => {
    const { status, body } = await get(`/v1/students/${CLASSMATE.id}/photo`, { cookie: null })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })

  it('rejects an unrecognised session cookie with a 401', async () => {
    const { status, body } = await get(`/v1/students/${CLASSMATE.id}/photo`, { cookie: 'session=forged' })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })
})
