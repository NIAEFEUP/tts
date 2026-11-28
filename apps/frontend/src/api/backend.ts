import { dev_config } from '../utils'
import Cookies from 'js-cookie'
import { ENV } from 'varlock/env'

// Backend origin. `VITE_APP_BACKEND_URL` is the single knob (see `.env.schema`):
//   - dev: unset → the local Elysia server (localhost:3000), which serves the
//     API directly (no `/api` prefix)
//   - staging/prod: the backend is mounted under `/api` by Niployments, so the
//     deployment sets this to `<origin>/api` through the `TTS_FE_VARS_CONTENT`
//     secret
//   - when unset in a prod build, fall back to the page origin plus `/api` (the
//     platform mount point), so URLs stay absolute — `socket.ts` parses this at
//     module load and would throw on an empty/relative value
const DEV_BACKEND_URL = `${dev_config.api.protocol}://${dev_config.api.host}:${dev_config.api.port}${dev_config.api.pathPrefix}`
const BACKEND_URL = ENV.VITE_APP_BACKEND_URL || (ENV.VITE_APP_PROD ? `${window.location.origin}/api` : DEV_BACKEND_URL)
const V1 = '/v1/auth'
const OIDC_LOGIN_URL = `${BACKEND_URL}${V1}/login`
const OIDC_LOGOUT_URL = `${BACKEND_URL}${V1}/logout`
const DEV_LOGIN_URL = `${BACKEND_URL}${V1}/dev-login`

/**
 * Make a request to the backend server.
 * @param route route to be appended to backend url
 * @returns response from the backend
 */
const apiRequest = async (route: string) => {
  const slash = route[0] === '/' ? '' : '/'
  const url = BACKEND_URL + slash + route

  const data = await fetch(url, { credentials: 'include' })
    .then((response) => response.json())
    .catch((error) => console.error(error))

  return data
}

/**
 * Retrieves the scrappe info from the backend
 */
const getInfo = async () => {
  return await apiRequest('/info/')
}

/**
 * Retrieves hashes for a list of course unit IDs.
 * @param ids Array of course unit IDs
 * @returns Object mapping course unit IDs to their hashes
 */
const getCourseUnitHashes = async (ids: number[]) => {
  if (ids.length === 0) return {}

  try {
    const queryString = ids.join(',')
    const response = await fetch(`${BACKEND_URL}/course_unit/hash?ids=${queryString}`, { credentials: 'include' })
    if (!response.ok) throw new Error('Network response was not ok')
    return await response.json()
  } catch (error) {
    console.error('Error fetching course unit hashes:', error)
    throw error
  }
}

const getCSRFToken = () => {
  return Cookies.get('csrftoken')
}

const csrfTokenName = (): string => {
  return 'X-CSRFToken'
}

const api = {
  getInfo,
  getCourseUnitHashes,
  getCSRFToken,
  csrfTokenName,
  BACKEND_URL,
  OIDC_LOGIN_URL,
  OIDC_LOGOUT_URL,
  DEV_LOGIN_URL,
}

export default api
