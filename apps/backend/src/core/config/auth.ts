// Auth configuration, read from the typed environment.
//
// The values themselves are declared and validated by varlock in `.env.schema`,
// and `src/env.d.ts` (generated) types `ENV`, so a misspelled or undeclared key
// is a compile error rather than a silent `undefined`. Everything here has a
// default so a local checkout starts without secrets; the OIDC routes report
// `oidc-not-configured` when a client id/secret is missing.

import { ENV } from 'varlock/env'

const DEFAULT_AUTHORIZE_ENDPOINT = 'https://open-id.up.pt/realms/sigarra/protocol/openid-connect/auth'
const DEFAULT_TOKEN_ENDPOINT = 'https://open-id.up.pt/realms/sigarra/protocol/openid-connect/token'
const DEFAULT_USERINFO_ENDPOINT = 'https://open-id.up.pt/realms/sigarra/protocol/openid-connect/userinfo'

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

/** Empty or whitespace-only values fall back, so `KEY=""` behaves like unset. */
function readString(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
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
  const frontendUrl = readString(ENV.FRONTEND_URL, 'http://localhost:3100')
  const clientId = ENV.OIDC_CLIENT_ID?.trim() ?? ''
  const clientSecret = ENV.OIDC_CLIENT_SECRET ?? ''

  const allowedOrigins = readString(ENV.ALLOWED_ORIGINS, frontendUrl)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  return {
    oidcConfigured: clientId.length > 0 && clientSecret.length > 0,
    clientId,
    clientSecret,
    redirectUri: readString(ENV.OIDC_REDIRECT_URI, 'http://localhost:3000/v1/auth/callback'),
    authorizeEndpoint: readString(ENV.OIDC_AUTHORIZE_ENDPOINT, DEFAULT_AUTHORIZE_ENDPOINT),
    tokenEndpoint: readString(ENV.OIDC_TOKEN_ENDPOINT, DEFAULT_TOKEN_ENDPOINT),
    userinfoEndpoint: readString(ENV.OIDC_USERINFO_ENDPOINT, DEFAULT_USERINFO_ENDPOINT),
    scopes: readString(ENV.OIDC_SCOPES, 'openid email profile uporto_data'),
    sessionTtlSeconds: (ENV.SESSION_TTL_DAYS ?? 30) * 24 * 60 * 60,
    frontendUrl,
    allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : [frontendUrl],
    secureCookies: ENV.COOKIE_SECURE === true || ENV.NODE_ENV === 'production',
    // On by default for local dev, but never in production — even if a deploy
    // forgets to set DEV_LOGIN_ENABLED=false, NODE_ENV=production disables it.
    devLoginEnabled: ENV.DEV_LOGIN_ENABLED !== false && ENV.NODE_ENV !== 'production',
    // Behind Niployments the service is exposed under `/api`; locally there is
    // no proxy, so the prefix is empty unless a deployment says otherwise.
    publicApiPrefix: normalisePrefix(readString(ENV.PUBLIC_API_PREFIX, ENV.NODE_ENV === 'production' ? '/api' : '')),
    devAccount: {
      username: ENV.SIGARRA_USERNAME?.trim() ?? '',
      password: ENV.SIGARRA_PASSWORD ?? '',
    },
  }
}
