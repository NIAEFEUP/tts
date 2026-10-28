import { Elysia, t } from 'elysia'
import { createBeginLogin } from '@/application/use-cases/auth/begin-login'
import { createCompleteLogin, InvalidOidcStateError } from '@/application/use-cases/auth/complete-login'
import { createDevLogin } from '@/application/use-cases/auth/dev-login'
import { createLogout } from '@/application/use-cases/auth/logout'
import type { AuthConfig } from '@/core/config/auth'
import type { DevAuthenticator } from '@/domain/ports/dev-authenticator'
import type { IdentityProvider } from '@/domain/ports/identity-provider'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { UserRepository } from '@/domain/ports/user.repository'
import { isAdmin } from '@/core/auth/user'
import { ErrorCode } from '@/interface/errors/errors'
import { createAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { anonymous, sessionInfo, sessionUser } from './auth.schemas'
import { RETURN_TO_COOKIE, STATE_COOKIE, TRANSIENT_COOKIE_TTL_SECONDS } from './auth.utils'

const OIDC_NOT_CONFIGURED = {
  error: 'Sigarra OIDC is not configured on this server',
  code: 'oidc-not-configured',
}

export type AuthRoutesDeps = {
  provider: IdentityProvider
  users: UserRepository
  sessions: SessionRepository
  sigarraDirect: DevAuthenticator
  config: AuthConfig
}

/**
 * Canonical auth routes, mounted under `/v1/auth` (the `/api` prefix is added by
 * the deployment, not declared here):
 *   GET  /login      — redirect to Sigarra (prod / federated)
 *   GET  /callback   — Sigarra redirects back; set the session cookie
 *   POST /dev-login  — dev-only Sigarra username/password login
 *   POST /logout     — clear the session
 *   GET  /me         — current user (or `{ signed: false }`)
 */
export const authRoutes = ({ provider, users, sessions, sigarraDirect, config }: AuthRoutesDeps) => {
  const beginLogin = createBeginLogin({ provider, frontendUrl: config.frontendUrl })
  const completeLogin = createCompleteLogin({
    provider,
    users,
    sessions,
    sessionTtlMs: config.sessionTtlSeconds * 1000,
    frontendUrl: config.frontendUrl,
  })
  const devLogin = createDevLogin({
    users,
    sessions,
    authenticator: sigarraDirect,
    credentials: config.devAccount,
    sessionTtlMs: config.sessionTtlSeconds * 1000,
  })
  const logout = createLogout({ sessions })

  return (
    new Elysia({
      prefix: '/v1/auth',
      // Every cookie this plugin writes (session + OIDC round-trip state) shares
      // one attribute set; only maxAge differs per cookie. Elysia's `cookie`
      // config applies it globally so call sites can't forget it.
      cookie: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: config.secureCookies },
    })
      .use(createAuthMiddleware({ resolveSession: sessions.resolve }))
      // `response` schemas below reference this named model. Elysia resolves
      // model names per-instance, so it must be registered on this plugin too —
      // the app-level registration in `openapiPlugin` is only visible when `use()`d
      // as a parent (and it is skipped entirely in production).
      .model({ ApiError: apiError })
      .get(
        '/login',
        ({ query, cookie, redirect, status }) => {
          if (!config.oidcConfigured) return status(503, OIDC_NOT_CONFIGURED)

          const { url, state, returnTo } = beginLogin(query.return_to)

          cookie[STATE_COOKIE].value = state
          cookie[STATE_COOKIE].maxAge = TRANSIENT_COOKIE_TTL_SECONDS
          cookie[RETURN_TO_COOKIE].value = returnTo
          cookie[RETURN_TO_COOKIE].maxAge = TRANSIENT_COOKIE_TTL_SECONDS

          return redirect(url, 302)
        },
        {
          query: t.Object({ return_to: t.Optional(t.String()) }),
          // `t.Void()` documents the 302 as bodyless — Elysia skips response
          // validation for `redirect()`'s `Response`, so this is docs-only.
          response: { 302: t.Void(), 503: 'ApiError' },
          detail: {
            tags: ['auth'],
            summary: 'Begin login',
            description: 'Redirects (302) to the Sigarra authorization endpoint.',
          },
        },
      )
      .get(
        '/callback',
        async ({ query, cookie, redirect, status }) => {
          if (!config.oidcConfigured) return status(503, OIDC_NOT_CONFIGURED)

          const clearTransient = () => {
            cookie[STATE_COOKIE].remove()
            cookie[RETURN_TO_COOKIE].remove()
          }

          if (query.error) {
            clearTransient()
            return status(401, {
              error: query.error_description ?? query.error,
              code: 'oidc-auth-error',
            })
          }

          if (!query.code) {
            return status(400, { error: 'Missing authorization code', code: 'oidc-missing-code' })
          }

          try {
            const { token, redirectTo } = await completeLogin({
              code: query.code,
              state: query.state ?? '',
              expectedState: cookie.oidc_state.value,
              returnTo: cookie.oidc_return_to.value,
            })

            clearTransient()
            cookie.session.value = token
            cookie.session.maxAge = config.sessionTtlSeconds

            return redirect(redirectTo, 302)
          } catch (error) {
            clearTransient()
            if (error instanceof InvalidOidcStateError) {
              return status(400, { error: 'Invalid OIDC state', code: 'oidc-state-mismatch' })
            }
            console.error('Sigarra OIDC callback failed:', error)
            return status(502, {
              error: 'Failed to complete Sigarra login',
              code: 'oidc-callback-failed',
            })
          }
        },
        {
          query: t.Object({
            code: t.Optional(t.String()),
            state: t.Optional(t.String()),
            error: t.Optional(t.String()),
            error_description: t.Optional(t.String()),
          }),
          cookie: t.Cookie({
            session: t.Optional(t.String()),
            oidc_state: t.Optional(t.String()),
            oidc_return_to: t.Optional(t.String()),
          }),
          response: { 302: t.Void(), 400: 'ApiError', 401: 'ApiError', 502: 'ApiError', 503: 'ApiError' },
          detail: {
            tags: ['auth'],
            summary: 'Complete login',
            description: 'Sigarra redirects here; sets the session cookie and redirects (302) to the frontend.',
          },
        },
      )
      .get(
        '/me',
        ({ user }) => {
          if (!user) return { signed: false as const }
          return {
            signed: true as const,
            id: user.id,
            name: user.name,
            email: user.email,
            isAdmin: isAdmin(user),
            role: user.role,
          }
        },
        {
          response: { 200: sessionInfo },
          detail: { tags: ['auth'], summary: 'Current user' },
        },
      )
      .post(
        '/dev-login',
        async ({ body, cookie, status }) => {
          // Dev-only: absent in production (see AuthConfig.devLoginEnabled).
          if (!config.devLoginEnabled) {
            return status(404, { error: 'Not found', code: ErrorCode.notFound })
          }

          const result = await devLogin({ username: body?.username, password: body?.password })

          if (!result.ok) {
            if (result.reason === 'not-configured') {
              return status(503, {
                error: 'Dev login is not configured (set SIGARRA_USERNAME / SIGARRA_PASSWORD)',
                code: 'dev-login-not-configured',
              })
            }
            return status(401, { error: 'Invalid Sigarra credentials', code: 'invalid-credentials' })
          }

          cookie.session.value = result.token
          cookie.session.maxAge = config.sessionTtlSeconds

          return {
            signed: true as const,
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            isAdmin: isAdmin(result.user),
            role: result.user.role,
          }
        },
        {
          body: t.Optional(
            t.Object({
              username: t.Optional(t.String()),
              password: t.Optional(t.String()),
            }),
          ),
          cookie: t.Cookie({ session: t.Optional(t.String()) }),
          response: { 200: sessionUser, 401: 'ApiError', 404: 'ApiError', 503: 'ApiError' },
          detail: {
            tags: ['auth'],
            summary: 'Dev login',
            description: 'Non-production only; hidden with a 404 when dev login is disabled.',
          },
        },
      )
      .post(
        '/logout',
        async ({ cookie }) => {
          await logout(cookie.session.value)
          cookie.session.remove()
          return { signed: false as const }
        },
        {
          cookie: t.Cookie({ session: t.Optional(t.String()) }),
          response: { 200: anonymous },
          detail: { tags: ['auth'], summary: 'Log out' },
        },
      )
  )
}
