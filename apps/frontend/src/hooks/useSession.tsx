import useSwr from 'swr'
import api from '../api/backend'

// The shape the components consume. `/v1/auth/me` returns the canonical user
// (`id`, `isAdmin`, …) for a valid session and 401 for anonymous callers;
// normalise both onto the field names the rest of the app still reads so only
// this hook changes.
export type SessionUser = {
  signed: boolean
  username: string
  name: string
  is_admin: boolean
  role: 'USER' | 'ADMIN' | 'SUPERUSER'
}

/** The signed-out session, returned for 401s and for responses without a user. */
const anonymous: SessionUser = {
  signed: false,
  username: '',
  name: '',
  is_admin: false,
  role: 'USER',
}

/** Normalizes the backend session into the shape the components consume. */
const useSession = () => {
  /**
   * Fetches the current session. A 401 is the normal anonymous case; every
   * other failure is rethrown so SWR retries instead of rendering signed-out UI.
   */
  const trySession = async (key: string): Promise<SessionUser> => {
    const res = await fetch(`${api.BACKEND_URL}/${key}`, {
      method: 'GET',
      credentials: 'include',
    })

    // 401 is the anonymous case, not a failure: return it so SWR does not
    // enter its retry/backoff path and thrash `isLoading`.
    if (res.status === 401) return anonymous

    if (!res.ok) {
      throw new Error(`Session check failed (${res.status})`)
    }

    const data = await res.json()
    if (!data?.signed) return anonymous

    return {
      signed: true,
      username: data.id,
      name: data.name,
      is_admin: Boolean(data.isAdmin),
      role: data.role ?? (data.isAdmin ? 'ADMIN' : 'USER'),
    }
  }

  const { data, error, mutate } = useSwr('v1/auth/me', trySession, {
    focusThrottleInterval: 1800000,
    revalidateOnMount: true,
  })

  // SWR keeps the last successful payload when a revalidation fails. A failed
  // check therefore cannot be shown as a live session: a user whose session
  // expired mid-visit would keep seeing their profile and the Admin link. Treat
  // it as unavailable (signed out) while SWR keeps retrying in the background.
  const unavailable = Boolean(error)

  if (!unavailable && data?.signed) {
    localStorage.setItem('signedIn', true.toString())
  }

  return {
    signedIn: !unavailable && data?.signed === true,
    user: unavailable ? null : (data ?? null),
    forceScheduleRevalidation: mutate,
    // Only the initial load counts as loading. Background revalidations
    // (`isValidating`) must not hide the login controls, and a failed check must
    // fall back to the signed-out UI instead of leaving the app stuck loading,
    // SWR's backoff can otherwise postpone the next attempt for minutes.
    isLoading: data === undefined && !unavailable,
  }
}

export default useSession
