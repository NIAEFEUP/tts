import type { AuthConfig } from '@/core/config/auth'

export const SESSION_COOKIE = 'session'
export const STATE_COOKIE = 'oidc_state'
export const RETURN_TO_COOKIE = 'oidc_return_to'

/** Login round-trips should complete well within this window. */
export const TRANSIENT_COOKIE_TTL_SECONDS = 600

/** Structural type for Elysia's cookie objects, without importing the generic. */
export type MutableCookie = {
  value?: unknown
  httpOnly?: boolean
  sameSite?: boolean | 'lax' | 'strict' | 'none'
  secure?: boolean
  path?: string
  maxAge?: number
  remove(): void
}

/**
 * Apply the shared cookie attributes at the call site.
 *
 * Elysia's plugin-level `cookie` option only takes effect on the *root* instance
 * that handles the request; a plugin mounted with `.use()` is ignored. The auth
 * routes are mounted as a plugin, so relying on that option silently dropped
 * HttpOnly/Secure/SameSite from every cookie (including the session).
 *
 * Keep this helper as the single place that defines the attribute set; call it
 * after assigning `value` and pass the cookie's own maxAge.
 */
export function applyCookiePreferences(cookie: MutableCookie, config: AuthConfig, maxAgeSeconds: number): void {
  cookie.httpOnly = true
  cookie.sameSite = 'lax'
  cookie.secure = config.secureCookies
  cookie.path = '/'
  cookie.maxAge = maxAgeSeconds
}
