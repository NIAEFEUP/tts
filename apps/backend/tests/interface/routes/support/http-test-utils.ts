import { TEST_SESSION_TOKEN } from './auth-test-utils'

// Shared HTTP plumbing for every route test.
//
// Feature harnesses (`catalog-test-utils`, `enrollment-request-test-utils`,
// `user-test-utils`, `student-test-utils`) build their app and fixtures, then
// delegate the actual request here, so all of them agree on how a request is
// built and how a response is read. Tests assert real HTTP behaviour through
// `createApp().handle(request)`: no listener and no database.

/**
 * Anything that can serve a request. The real `App` satisfies it, and a tiny
 * stub can too, which is what lets `routes/http.test.ts` pin this helper's
 * contract without depending on a route.
 */
export type HttpApp = { handle: (request: Request) => Response | Promise<Response> }

/** Error bodies every guarded route returns, so tests share one copy. */
export const UNAUTHORIZED_BODY = { error: 'Authentication required', code: 'unauthorized' }
export const VALIDATION_ERROR_BODY = { error: 'Request failed validation', code: 'validation-error' }
export const FORBIDDEN_BODY = { error: 'Not allowed', code: 'forbidden' }

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type ApiResponse = {
  status: number
  contentType: string
  /** Absolute `Location` of a `201`, or `null` when the route did not set one. */
  location: string | null
  /** Parsed JSON, or `null` when the response carries no JSON body (`204`, HTML error pages). */
  body: unknown
}

export type RequestOptions = {
  method?: HttpMethod
  /** JSON-encoded and sent with `content-type: application/json` when present. */
  body?: unknown
  /** Extra request headers, merged last so they can override the defaults. */
  headers?: Record<string, string>
  /** Cookie header to send. Defaults to the signed-in test session; `null` sends none. */
  cookie?: string | null
  /** Set to `false` to send no cookie. Ignored when `cookie` is given. */
  authenticated?: boolean
}

const DEFAULT_COOKIE = `session=${TEST_SESSION_TOKEN}`

/**
 * Issues one request against `app` and reads the response without assuming it
 * is JSON, so a `204` or a text/HTML error page does not throw.
 */
export async function request(app: HttpApp, path: string, options: RequestOptions = {}): Promise<ApiResponse> {
  const { method = 'GET', body, headers = {}, cookie, authenticated = true } = options
  const cookieHeader = cookie !== undefined ? cookie : authenticated ? DEFAULT_COOKIE : null
  const hasBody = body !== undefined

  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    }),
  )

  const contentType = response.headers.get('content-type') ?? ''

  return {
    status: response.status,
    contentType,
    location: response.headers.get('location'),
    // Only parse what claims to be JSON: an empty 204 or an HTML error page
    // would make `response.json()` throw and hide the real assertion failure.
    body: contentType.startsWith('application/json') ? ((await response.json()) as unknown) : null,
  }
}

/**
 * `request` bound to `app`, plus one helper per method so a test reads
 * `post('/v1/exchanges', { body })` instead of passing `method` every time.
 * `del` is spelled out because `delete` is a keyword.
 */
export function createRequester(app: HttpApp) {
  const call = (method: HttpMethod, path: string, options: RequestOptions = {}) =>
    request(app, path, { ...options, method })

  return {
    request: (path: string, options: RequestOptions = {}) => request(app, path, options),
    get: (path: string, options: RequestOptions = {}) => call('GET', path, options),
    post: (path: string, options: RequestOptions = {}) => call('POST', path, options),
    put: (path: string, options: RequestOptions = {}) => call('PUT', path, options),
    patch: (path: string, options: RequestOptions = {}) => call('PATCH', path, options),
    del: (path: string, options: RequestOptions = {}) => call('DELETE', path, options),
  }
}
