import { describe, expect, it } from 'bun:test'
import type { AuthUser } from '@/core/auth/user'
import type { AuthConfig } from '@/core/config/auth'
import { authCompatRoutes } from '@/interface/routes/auth/auth-compat.routes'
import {
  TEST_SESSION_TOKEN,
  TEST_USER,
  createFakeDevAuthenticator,
  createFakeSessions,
  createFakeUsers,
  createTestAuthConfig,
  getCookie,
} from '../support/auth-test-utils'

// The legacy frontend shims share the same fake repositories and config as the
// canonical auth tests (`auth-test-utils`); only the routes under test differ.

// Dev login has no email claim, hence `email: null`.
const USER: AuthUser = { ...TEST_USER, email: null }

function buildApp(overrides: Partial<AuthConfig> = {}) {
  return authCompatRoutes({
    users: createFakeUsers(USER),
    sessions: createFakeSessions(USER),
    sigarraDirect: createFakeDevAuthenticator(),
    config: createTestAuthConfig(overrides),
  })
}

describe('auth compat routes', () => {
  it('aliases the legacy login link to the canonical route', async () => {
    const app = buildApp()
    const res = await app.handle(
      new Request('http://localhost/oidc-auth/authenticate/?return_to=http://localhost:3100/x'),
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(
      'http://localhost/v1/auth/login?return_to=http%3A%2F%2Flocalhost%3A3100%2Fx',
    )
  })

  it('prepends the deployment mount prefix to the canonical login link', async () => {
    const app = buildApp({ publicApiPrefix: '/api' })
    const res = await app.handle(new Request('http://tts.niaefeup.pt/oidc-auth/authenticate/'))

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://tts.niaefeup.pt/api/v1/auth/login')
  })

  it('keeps the https scheme when behind a TLS proxy', async () => {
    const app = buildApp()
    const res = await app.handle(
      new Request('http://tts-dev.niaefeup.pt/oidc-auth/authenticate/', {
        headers: { 'x-forwarded-proto': 'https' },
      }),
    )

    expect(res.headers.get('location')).toBe('https://tts-dev.niaefeup.pt/v1/auth/login')
  })

  it('returns the legacy session shape at /auth/info/', async () => {
    const app = buildApp()
    const res = await app.handle(
      new Request('http://localhost/auth/info/', { headers: { cookie: `session=${TEST_SESSION_TOKEN}` } }),
    )

    expect(await res.json()).toEqual({
      signed: true,
      username: USER.id,
      name: USER.name,
      eligible_exchange: false,
      is_admin: false,
    })
  })

  it('reports anonymous at /auth/info/ without a session', async () => {
    const app = buildApp()
    const res = await app.handle(new Request('http://localhost/auth/info/'))

    expect(await res.json()).toEqual({ signed: false })
  })

  it('hides /sigarra_login/ unless enabled', async () => {
    const app = buildApp()
    const res = await app.handle(
      new Request('http://localhost/sigarra_login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'up1', password: 'pw' }),
      }),
    )

    expect(res.status).toBe(404)
  })

  it('issues a session through /sigarra_login/ when enabled', async () => {
    const app = buildApp({ devLoginEnabled: true })
    const res = await app.handle(
      new Request('http://localhost/sigarra_login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'up1', password: 'pw' }),
      }),
    )

    expect(res.status).toBe(200)
    expect(getCookie(res, 'session')).toBeTruthy()
  })
})
