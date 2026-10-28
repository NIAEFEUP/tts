import useSwr from 'swr'
import api from '../api/backend'

// The shape the components consume. `/v1/auth/me` returns the canonical
// user (`id`, `isAdmin`, …); map it onto the field names the rest of the app
// still reads so only this hook changes.
export type SessionUser = {
  signed: boolean
  username: string
  name: string
  is_admin: boolean
  role: 'USER' | 'ADMIN' | 'SUPERUSER'
  eligible_exchange: boolean
}

const useSession = () => {
  const anonymous: SessionUser = {
    signed: false,
    username: '',
    name: '',
    is_admin: false,
    role: 'USER',
    eligible_exchange: false,
  }

  const trySession = async (key): Promise<SessionUser> => {
    try {
      const res = await fetch(`${api.BACKEND_URL}/${key}`, {
        method: 'GET',
        credentials: 'include',
      })

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
    } catch (e) {
      console.error(e)
      return anonymous
    }
  }

  const { data, isLoading, mutate, isValidating } = useSwr('v1/auth/me', trySession, {
    focusThrottleInterval: 1800000,
    revalidateOnMount: true,
  })

  if (data) {
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
