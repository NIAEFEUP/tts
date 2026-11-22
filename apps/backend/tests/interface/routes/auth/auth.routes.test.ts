import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { authRoutes } from '@/interface/routes/auth/auth.routes'
import { errorHandler } from '@/interface/middleware/error-handler'
import {
  ADMIN,
  TEST_SESSION_TOKEN,
  createFakeDevAuthenticator,
  createFakeIdentityProvider,
  createFakeSessions,
  createFakeUsers,
  createTestAuthConfig,
  getCookie,
} from '../support/auth-test-utils'
import { UNAUTHORIZED_BODY } from '../support/catalog-test-utils'

// The OIDC flow is driven end to end: `/login` sets the state cookie, the
// callback verifies it and mints a session, and `/me` resolves that session
// against the fake repositories from `auth-test-utils`.

const ADMIN_USER = ADMIN

function buildApp(config = createTestAuthConfig()) {
  // Mirror `main.ts`: the global error handler turns a thrown `HttpError` into
  // the `{ error, code }` body the frontend (and these tests) expect.
  return new Elysia().use(errorHandler).use(
    authRoutes({
      provider: createFakeIdentityProvider(ADMIN_USER),
      users: createFakeUsers(ADMIN_USER),
      sessions: createFakeSessions(ADMIN_USER),
      sigarraDirect: createFakeDevAuthenticator(),
      config,
    }),
  )
}

describe('auth routes', () => {
  it('redirects to the IdP and stores state', async () => {
    const app = buildApp()
    const res = await app.handle(new Request('http://localhost/v1/auth/login'))

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toContain('https://idp.test/authorize')
    expect(getCookie(res, 'oidc_state')).toBeTruthy()
  })

  it('returns 503 when OIDC is not configured', async () => {
    const app = buildApp(createTestAuthConfig({ oidcConfigured: false, clientId: '', clientSecret: '' }))
    const res = await app.handle(new Request('http://localhost/v1/auth/login'))

    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('oidc-not-configured')
  })

  it('completes the callback: sets a session cookie and redirects to the frontend', async () => {
    const app = buildApp()

    const login = await app.handle(new Request('http://localhost/v1/auth/login'))
    const state = getCookie(login, 'oidc_state')

    const callback = await app.handle(
      new Request(`http://localhost/v1/auth/callback?code=abc&state=${state}`, {
        headers: { cookie: `oidc_state=${state}` },
      }),
    )

    expect(callback.status).toBe(302)
    expect(callback.headers.get('location')).toBe('http://localhost:3100/')
    expect(getCookie(callback, 'session')).toBeTruthy()
  })

  it('rejects a callback with a mismatched state', async () => {
    const app = buildApp()
    const res = await app.handle(
      new Request('http://localhost/v1/auth/callback?code=abc&state=forged', {
        headers: { cookie: 'oidc_state=expected' },
      }),
    )

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('oidc-state-mismatch')
  })

  it('rejects /me without a session with a 401', async () => {
    const app = buildApp()
    const res = await app.handle(new Request('http://localhost/v1/auth/me'))

    expect(res.status).toBe(401)
    expect(res.headers.get('content-type')).toMatch(/^application\/json/)
    expect(await res.json()).toEqual(UNAUTHORIZED_BODY)
  })

  it('rejects /me with an unrecognised session cookie', async () => {
    const app = buildApp()
    const res = await app.handle(
      new Request('http://localhost/v1/auth/me', {
        headers: { cookie: 'session=forged' },
      }),
    )

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual(UNAUTHORIZED_BODY)
  })

  it('reports the user on /me with a valid session cookie', async () => {
    const app = buildApp()

    const login = await app.handle(new Request('http://localhost/v1/auth/login'))
    const state = getCookie(login, 'oidc_state')
    const callback = await app.handle(
      new Request(`http://localhost/v1/auth/callback?code=abc&state=${state}`, {
        headers: { cookie: `oidc_state=${state}` },
      }),
    )
    const session = getCookie(callback, 'session')

    const me = await app.handle(
      new Request('http://localhost/v1/auth/me', {
        headers: { cookie: `session=${session}` },
      }),
    )

    expect(me.status).toBe(200)
    expect(await me.json()).toEqual({
      signed: true,
      id: ADMIN_USER.id,
      name: ADMIN_USER.name,
      email: ADMIN_USER.email,
      isAdmin: true,
      role: 'ADMIN',
    })
  })

  it('clears the session on logout', async () => {
    const app = buildApp()
    const res = await app.handle(
      new Request('http://localhost/v1/auth/logout', {
        method: 'POST',
        headers: { cookie: `session=${TEST_SESSION_TOKEN}` },
      }),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ signed: false })

    const me = await app.handle(
      new Request('http://localhost/v1/auth/me', {
        headers: { cookie: `session=${TEST_SESSION_TOKEN}` },
      }),
    )

    expect(me.status).toBe(401)
    expect(await me.json()).toEqual(UNAUTHORIZED_BODY)
  })

  it('logs in via dev-login using the configured account (no body)', async () => {
    const app = buildApp(
      createTestAuthConfig({ devLoginEnabled: true, devAccount: { username: 'up1', password: 'pw' } }),
    )
    const res = await app.handle(new Request('http://localhost/v1/auth/dev-login', { method: 'POST' }))

    expect(res.status).toBe(200)
    expect((await res.json()).signed).toBe(true)
    expect(getCookie(res, 'session')).toBeTruthy()
  })

  it('hides dev-login when disabled', async () => {
    const app = buildApp(createTestAuthConfig({ devLoginEnabled: false }))
    const res = await app.handle(new Request('http://localhost/v1/auth/dev-login', { method: 'POST' }))

    expect(res.status).toBe(404)
  })

  it('reports dev-login as unconfigured when no credentials exist', async () => {
    const app = buildApp(createTestAuthConfig({ devLoginEnabled: true, devAccount: { username: '', password: '' } }))
    const res = await app.handle(new Request('http://localhost/v1/auth/dev-login', { method: 'POST' }))

    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('dev-login-not-configured')
  })
})
