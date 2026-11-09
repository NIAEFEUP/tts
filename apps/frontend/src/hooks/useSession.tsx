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
  eligible_exchange: boolean
}

/** Normalises the backend session into the shape the components consume. */
const useSession = () => {
  const anonymous: SessionUser = {
    signed: false,
    username: '',
    name: '',
    is_admin: false,
    role: 'USER',
    eligible_exchange: false,
  }

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
      // Exchange eligibility is not exposed by the backend yet.
      eligible_exchange: false,
    }
  }

  const { data, isLoading, mutate, isValidating } = useSwr('v1/auth/me', trySession, {
    focusThrottleInterval: 1800000,
    revalidateOnMount: true,
  })

  if (data?.signed) {
    localStorage.setItem('signedIn', true.toString())
  }

  return {
    signedIn: data ? data.signed : false,
    user: data ? data : null,
    forceScheduleRevalidation: mutate,
    isLoading: isLoading || isValidating || data === undefined,
  }
}

export default useSession
