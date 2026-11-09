import { describe, expect, it } from 'bun:test'

import { TEST_USER } from '../support/auth-test-utils'
import { UNAUTHORIZED_BODY } from '../support/catalog-test-utils'
import { createUsersApp } from '../support/user-test-utils'

// `createUsersApp` builds the real app with fake repositories: the fake session
// repository recognises `session=tok-1` as `TEST_USER`, while `cookie: null`
// and a forged cookie both resolve to no user. The enrollment repository is
// unused by `/users/me`, so an empty one is enough.
const { get } = createUsersApp({ findByUserId: async () => [] })

const EXPECTED_PROFILE = {
  signed: true,
  id: TEST_USER.id,
  name: TEST_USER.name,
  email: TEST_USER.email,
  isAdmin: false,
  role: 'USER',
}

describe('users me routes', () => {
  it('returns the current user profile', async () => {
    const { status, contentType, body } = await get('/v1/users/me')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual(EXPECTED_PROFILE)
  })

  it('rejects an anonymous caller with a 401 unauthorized', async () => {
    const { status, body } = await get('/v1/users/me', { cookie: null })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })

  it('rejects an unrecognised session cookie with a 401', async () => {
    const { status, body } = await get('/v1/users/me', { cookie: 'session=forged' })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })

  it('returns exactly the same payload and status as /v1/auth/me', async () => {
    const usersMe = await get('/v1/users/me')
    const authMe = await get('/v1/auth/me')

    expect(usersMe.status).toBe(authMe.status)
    expect(usersMe.body).toEqual(authMe.body)
  })
})
