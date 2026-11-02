import type { AuthUser } from '@/core/auth/user'
import type { AuthConfig } from '@/core/config/auth'
import type { DevAuthenticator } from '@/domain/ports/dev-authenticator'
import type { IdentityProvider } from '@/domain/ports/identity-provider'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { UserRepository } from '@/domain/ports/user.repository'

// Shared fakes for the auth route tests (`auth.routes.test.ts` and the legacy
// `auth-compat.routes.test.ts` shims). The auth config shape, the signed-in
// user, and the cookie helper are defined once here so a new config field or a
// changed login flow only has to be updated in one place.
//
// Like `catalog-test-utils`, this drives the routes directly through
// `route.handle(request)` — no listener and no database.

export const TEST_USER: AuthUser = {
  id: 'up202012345',
  name: 'Ana Silva',
  email: 'up202012345@up.pt',
  role: 'USER',
}

/** Same person with `ADMIN` privileges, for admin-only routes. */
export const ADMIN: AuthUser = { ...TEST_USER, role: 'ADMIN' }

/** The session cookie `createFakeSessions` already recognises. */
export const TEST_SESSION_TOKEN = 'tok-1'

/** A complete `AuthConfig`, with dev-login off and OIDC pointed at `idp.test`. */
export function createTestAuthConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    oidcConfigured: true,
    clientId: 'client',
    clientSecret: 'secret',
    redirectUri: 'http://localhost:3000/v1/auth/callback',
    authorizeEndpoint: 'https://idp.test/authorize',
    tokenEndpoint: 'https://idp.test/token',
    userinfoEndpoint: 'https://idp.test/userinfo',
    scopes: 'openid',
    sessionTtlSeconds: 3600,
    frontendUrl: 'http://localhost:3100',
    allowedOrigins: ['http://localhost:3100'],
    secureCookies: false,
    devLoginEnabled: false,
    publicApiPrefix: '',
    devAccount: { username: '', password: '' },
    ...overrides,
  }
}

/** An OIDC provider that redirects to `idp.test` and authenticates as `user`. */
export function createFakeIdentityProvider(user: AuthUser = TEST_USER): IdentityProvider {
  return {
    authorizationUrl: ({ state }) => `https://idp.test/authorize?state=${state}`,
    exchangeCodeForUser: async () => ({ nmec: user.id, name: user.name, email: user.email }),
  }
}

export function createFakeUsers(user: AuthUser = TEST_USER): UserRepository {
  return {
    upsertFromClaims: async () => user,
    findById: async (id) => (id === user.id ? user : null),
  }
}

/**
 * A stateful `SessionRepository`: `TEST_SESSION_TOKEN` is signed in from the
 * start, and every `issue()` mints a new `tok-N` the app can then resolve.
 */
export function createFakeSessions(user: AuthUser = TEST_USER): SessionRepository {
  const tokens = new Map<string, AuthUser>([[TEST_SESSION_TOKEN, user]])
  // Monotonic counter so a revoked `tok-N` is never minted again.
  let next = 1

  return {
    issue: async () => {
      const token = `tok-${++next}`
      tokens.set(token, user)
      return token
    },
    resolve: async (token) => tokens.get(token) ?? null,
    revoke: async (token) => {
      tokens.delete(token)
    },
  }
}

/** A Sigarra username/password authenticator that accepts anyone. */
export function createFakeDevAuthenticator(name: string | null = TEST_USER.name): DevAuthenticator {
  return {
    authenticate: async () => ({ name }),
  }
}

/** Value of `name` in the `Set-Cookie` headers of `response`, or `null`. */
export function getCookie(response: Response, name: string): string | null {
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(';')
    const [key] = pair.split('=')
    // Slice instead of splitting: cookie values can contain `=` (signed/opaque).
    const value = pair.slice(key.length + 1)
    if (key === name) return value
  }
  return null
}
