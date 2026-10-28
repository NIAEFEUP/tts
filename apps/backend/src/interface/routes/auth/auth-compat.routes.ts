import { Elysia, t } from 'elysia'
import { createDevLogin } from '@/application/use-cases/auth/dev-login'
import { createGetCurrentUser } from '@/application/use-cases/auth/get-current-user'
import { createLogout } from '@/application/use-cases/auth/logout'
import type { AuthConfig } from '@/core/config/auth'
import type { DevAuthenticator } from '@/domain/ports/dev-authenticator'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { UserRepository } from '@/domain/ports/user.repository'
import { isAdmin } from '@/core/auth/user'
import { ErrorCode } from '@/interface/errors/errors'
import { createAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { anonymous, legacySessionInfo, userProfile } from './auth.schemas'

export type AuthCompatDeps = {
  users: UserRepository
  sessions: SessionRepository
  sigarraDirect: DevAuthenticator
  config: AuthConfig
}

/**
 * Compatibility shims for the un-migrated frontend, mounted at the root (the FE
 * builds its URLs from `BACKEND_URL` with an empty path prefix). Drop these once
 * the frontend points at `/v1/auth/*`.
 *
 *   GET  /oidc-auth/authenticate/ — legacy login link → /v1/auth/login
 *   POST /oidc-auth/logout/       — legacy logout (ignores the CSRF header)
 *   GET  /auth/info/              — legacy session info shape
 *   POST /sigarra_login/          — dev-only direct login (env-gated)
 */
export const authCompatRoutes = ({ users, sessions, sigarraDirect, config }: AuthCompatDeps) => {
  const getCurrentUser = createGetCurrentUser({ sessions })
  const logout = createLogout({ sessions })
  const devLogin = createDevLogin({
    users,
    sessions,
    authenticator: sigarraDirect,
    credentials: config.devAccount,
    sessionTtlMs: config.sessionTtlSeconds * 1000,
  })

  return (
    new Elysia({
      // Same attribute set as the canonical routes (see auth.routes.ts).
      cookie: { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: config.secureCookies },
    })
      .use(createAuthMiddleware({ resolveSession: sessions.resolve }))
      // Same per-instance named model as the canonical routes: `'ApiError'` in a
      // `response` schema is only resolvable where it is registered.
      .model({ ApiError: apiError })
      .get(
        '/oidc-auth/authenticate/',
        ({ query, redirect, request, headers }) => {
          // Undici (the Node adapter) rejects relative redirects, so build an
          // absolute URL. Behind the dev TLS proxy the backend speaks plain HTTP,
          // so honour X-Forwarded-Proto to keep the public scheme https.
          // The `/api` mount prefix is added by the deployment (Niployments), so
          // it comes from config rather than the route declaration.
          const target = new URL(`${config.publicApiPrefix}/v1/auth/login`, request.url)
          const forwardedProto = headers['x-forwarded-proto']?.split(',')[0]?.trim()
          if (forwardedProto) target.protocol = `${forwardedProto}:`
          if (query.return_to) target.searchParams.set('return_to', query.return_to)
          return redirect(target.toString(), 302)
        },
        {
          query: t.Object({ return_to: t.Optional(t.String()) }),
          response: { 302: t.Void() },
          detail: {
            tags: ['auth-compat'],
            summary: 'Legacy login link',
            description: 'Alias for `GET /api/v1/auth/login`.',
          },
        },
      )
      .post(
        '/oidc-auth/logout/',
        async ({ cookie }) => {
          await logout(cookie.session.value)
          cookie.session.remove()
          return { signed: false as const }
        },
        {
          cookie: t.Cookie({ session: t.Optional(t.String()) }),
          response: { 200: anonymous },
          detail: { tags: ['auth-compat'], summary: 'Legacy logout' },
        },
      )
      .get(
        '/auth/info/',
        async ({ cookie }) => {
          const current = await getCurrentUser(cookie.session.value)
          if (!current) return { signed: false as const }

          return {
            signed: true as const,
            username: current.id,
            name: current.name,
            // Exchange eligibility is not implemented on the new backend yet; the
            // frontend uses this flag to gate the exchange UI, so stay false until
            // the eligibility endpoint lands.
            eligible_exchange: false,
            is_admin: isAdmin(current),
          }
        },
        {
          cookie: t.Cookie({ session: t.Optional(t.String()) }),
          response: { 200: legacySessionInfo },
          detail: { tags: ['auth-compat'], summary: 'Legacy session info' },
        },
      )
      .post(
        '/sigarra_login/',
        async ({ body, cookie, status }) => {
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

          return { message: 'Login successful', user: result.user }
        },
        {
          body: t.Optional(
            t.Object({
              username: t.Optional(t.String()),
              password: t.Optional(t.String()),
            }),
          ),
          cookie: t.Cookie({ session: t.Optional(t.String()) }),
          response: {
            200: t.Object({ message: t.String(), user: userProfile }),
            401: 'ApiError',
            404: 'ApiError',
            503: 'ApiError',
          },
          detail: {
            tags: ['auth-compat'],
            summary: 'Legacy dev login',
            description: 'Alias for `POST /api/v1/auth/dev-login`; hidden with a 404 when dev login is disabled.',
          },
        },
      )
  )
}
