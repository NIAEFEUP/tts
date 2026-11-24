// Auth configuration, read from the typed environment.
//
// The values themselves are declared and validated by varlock in `.env.schema`,
// and `src/env.d.ts` (generated) types `ENV`, so a misspelled or undeclared key
// is a compile error rather than a silent `undefined`. Everything here has a
// default so a local checkout starts without secrets; the OIDC routes report
// `oidc-not-configured` when a client id/secret is missing.

import { ENV } from 'varlock/env'

export type AuthConfig = {
  /** True once a client id and secret are present; false disables the OIDC routes. */
  oidcConfigured: boolean
  clientId: string
  clientSecret: string
  redirectUri: string
  authorizeEndpoint: string
  tokenEndpoint: string
  userinfoEndpoint: string
  scopes: string
  sessionTtlSeconds: number
  frontendUrl: string
  allowedOrigins: string[]
  secureCookies: boolean
  devLoginEnabled: boolean
  /**
   * Path prefix the platform mounts the API under, e.g. `/api` behind
   * Niployments. Empty in local dev, where the backend is reached directly.
   * Only used to build browser-visible (absolute) URLs such as the compat
   * login redirect — route declarations never include it.
   */
  publicApiPrefix: string
  /** Dev account used by `/v1/auth/dev-login` when no credentials are sent. */
  devAccount: { username: string; password: string }
}

/**
 * Normalises a mount prefix to `''` or `/<segment>` (no trailing slash), so it
 * can be concatenated with a route path without producing `//` or `api/v1`.
 */
function normalisePrefix(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function loadAuthConfig(): AuthConfig {
  const frontendUrl = ENV.FRONTEND_URL.trim()
  const clientId = ENV.OIDC_CLIENT_ID?.trim() ?? ''
  const clientSecret = ENV.OIDC_CLIENT_SECRET ?? ''

  const allowedOrigins = ENV.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return {
    oidcConfigured: clientId.length > 0 && clientSecret.length > 0,
    clientId,
    clientSecret,
    redirectUri: ENV.OIDC_REDIRECT_URI.trim(),
    authorizeEndpoint: ENV.OIDC_AUTHORIZE_ENDPOINT.trim(),
    tokenEndpoint: ENV.OIDC_TOKEN_ENDPOINT.trim(),
    userinfoEndpoint: ENV.OIDC_USERINFO_ENDPOINT.trim(),
    scopes: ENV.OIDC_SCOPES.trim(),
    sessionTtlSeconds: ENV.SESSION_TTL_DAYS * 24 * 60 * 60,
    frontendUrl,
    allowedOrigins,
    secureCookies: ENV.COOKIE_SECURE || ENV.NODE_ENV === 'production',
    // On by default for local dev, but never in production — even if a deploy
    // forgets to set DEV_LOGIN_ENABLED=false, NODE_ENV=production disables it.
    devLoginEnabled: ENV.DEV_LOGIN_ENABLED && ENV.NODE_ENV !== 'production',
    // Behind Niployments the service is exposed under `/api`; locally there is
    // no proxy, so the prefix is empty unless a deployment says otherwise.
    publicApiPrefix: normalisePrefix(ENV.PUBLIC_API_PREFIX || (ENV.NODE_ENV === 'production' ? '/api' : '')),
    devAccount: {
      username: ENV.SIGARRA_USERNAME?.trim() ?? '',
      password: ENV.SIGARRA_PASSWORD ?? '',
    },
  }
}
