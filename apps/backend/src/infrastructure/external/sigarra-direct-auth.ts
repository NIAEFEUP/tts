// Dev-only credential check against Sigarra, used by `POST /v1/auth/dev-login`
// and the `/sigarra_login/` shim when federated (OIDC) auth is off.
//
// Sigarra login mechanism (unchanged from the legacy backend): successful login
// yields HTTP 200 + SI_SECURITY and SI_SESSION cookies; a failed login yields
// HTTP 200 + an HTML page with only HTTP_SESSION. Once logged in, the mobile
// profile endpoint (`mob_fest_geral.perfil`) returns the student's real name.

import type { DevAuthenticator, DevIdentity } from '@/domain/ports/dev-authenticator'

const SIGARRA_VALIDATION_ENDPOINT = 'https://sigarra.up.pt/feup/pt/vld_validacao.validacao'
const SIGARRA_PROFILE_ENDPOINT = 'https://sigarra.up.pt/feup/pt/mob_fest_geral.perfil'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

/** `k=v; k2=v2` from a list of `Set-Cookie` headers. */
function toCookieHeader(setCookies: string[]): string {
  return setCookies.map((cookie) => cookie.split(';')[0]).join('; ')
}

async function fetchStudentName(nmec: string, cookieHeader: string): Promise<string | null> {
  try {
    const url = `${SIGARRA_PROFILE_ENDPOINT}?pv_codigo=${encodeURIComponent(nmec)}`
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Cookie: cookieHeader },
    })
    if (!response.ok) return null

    const profile = (await response.json()) as { nome?: unknown }
    return typeof profile.nome === 'string' && profile.nome.trim() ? profile.nome.trim() : null
  } catch {
    // Name is best-effort — a scrape failure must not break the login.
    return null
  }
}

export function createSigarraDirectAuth(): DevAuthenticator {
  return {
    async authenticate(username, password): Promise<DevIdentity | null> {
      const params = new URLSearchParams()
      params.append('p_user', username)
      params.append('p_pass', password)

      const response = await fetch(SIGARRA_VALIDATION_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
        },
        body: params,
        redirect: 'manual',
      })

      const setCookies = response.headers.getSetCookie()
      const cookieHeader = toCookieHeader(setCookies)
      if (!cookieHeader.includes('SI_SECURITY')) return null

      return { name: await fetchStudentName(username, cookieHeader) }
    },
  }
}
