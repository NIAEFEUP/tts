import { describe, expect, it } from 'bun:test'

import { status, t } from 'elysia'

import { createApp } from '@/main'
import { ErrorCode, httpError, HttpError, VALIDATION_ERROR_MESSAGE } from '@/interface/errors/errors'

// The reference integration-test pattern from I-1: drive the real app through
// `createApp().handle(request)` — no listener, no fixtures, no database.
//
// Routes are appended to `createApp()` because the app does not own a failing
// route yet; the faculties endpoints (the other half of I-1) will test their
// own errors this same way. `createApp()` touches no database — dependencies
// are injected per route — so this runs on a bare checkout.
//
// `bun:test` keeps the runner identical to every other suite in `tests/`.

import type { FacultyRepository } from '@/domain/ports/faculty.repository'

const fakeRepository: FacultyRepository = {
  async findAll() {
    return []
  },
  async findByAcronym() {
    return null
  },
  async findCoursesByFaculty() {
    return []
  },
}

const app = createApp({ repositories: { facultyRepository: fakeRepository } })
  .get('/ok', () => ({ message: 'Hello from tts-be!' }))
  .get('/thrown', () => {
    throw httpError.notFound('Faculty FEUP was not found')
  })
  .get('/domain-code', () => {
    throw new HttpError('faculty-not-found', 'Faculty with acronym FAKE was not found', 404)
  })
  .get('/generic-code', () => {
    throw httpError.badRequest('page_size must be a positive integer')
  })
  .get('/validated', ({ query }) => ({ year: query.year }), { query: t.Object({ year: t.String() }) })
  .get('/boom', () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:5432')
  })
  .get('/driver-failure', () => {
    throw new HttpError('db-timeout', 'connect ETIMEDOUT 127.0.0.1:5432', 503)
  })
  .get('/internal-factory', () => {
    throw httpError.internal('connect ECONNREFUSED 127.0.0.1:5432')
  })
  .get('/bad-response', () => ({ id: 'not-a-number' }) as unknown as { id: number }, {
    response: t.Object({ id: t.Number() }),
  })
  .get('/status-bare', () => {
    throw status(401)
  })
  .get('/status-body', () => {
    throw status(403, { error: 'not an admin of this course', code: 'forbidden' })
  })
  .get('/status-unmapped', () => {
    throw status(429)
  })
  .get('/status-validation', () => {
    throw status(422)
  })

const get = async (path: string) => {
  const response = await app.handle(new Request(`http://localhost${path}`))
  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    body: (await response.json()) as unknown,
  }
}

type HttpResult = Awaited<ReturnType<typeof get>>

/** Runs `fn` with `console.error` captured, for the branches that log. */
const captureConsole = async (fn: () => Promise<HttpResult>) => {
  const logged: string[] = []
  const consoleError = console.error
  console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '))

  try {
    return { response: await fn(), logged }
  } finally {
    console.error = consoleError
  }
}

describe('error handler', () => {
  it('a successful response is left untouched', async () => {
    const { status, contentType, body } = await get('/ok')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual({ message: 'Hello from tts-be!' })
  })

  it('routes that never fail keep working', async () => {
    const { status } = await get('/health')

    expect(status).toBe(200)
  })

  it('a thrown HttpError becomes { error, code } with the right status', async () => {
    const { status, contentType, body } = await get('/thrown')

    expect(status).toBe(404)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual({ error: 'Faculty FEUP was not found', code: 'not-found' })
  })

  it('a domain code keeps its own status instead of failing as a 500', async () => {
    const { status, body } = await get('/domain-code')

    expect(status).toBe(404)
    expect(body).toEqual({
      error: 'Faculty with acronym FAKE was not found',
      code: 'faculty-not-found',
    })
  })

  it('the generic factories map to their documented statuses', async () => {
    const { status, body } = await get('/generic-code')

    expect(status).toBe(400)
    expect(body).toEqual({ error: 'page_size must be a positive integer', code: ErrorCode.badRequest })
  })

  it("input validation failures are the caller's fault: 422 validation-error", async () => {
    const valid = await get('/validated?year=2025')
    expect(valid.status).toBe(200)
    expect(valid.body).toEqual({ year: '2025' })

    const invalid = await get('/validated')
    expect(invalid.status).toBe(422)
    expect(invalid.body).toEqual({
      error: VALIDATION_ERROR_MESSAGE,
      code: ErrorCode.validationError,
    })
  })

  it('a route failing its own response schema is a logged 500, not a 400', async () => {
    const { response, logged } = await captureConsole(() => get('/bad-response'))

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'Something went wrong', code: ErrorCode.internalError })
    expect(logged.length).toBe(1)
    expect(logged[0]).toMatch(/Response validation failed/)
  })

  it('unexpected errors are logged server-side and never leaked', async () => {
    const { response, logged } = await captureConsole(() => get('/boom'))

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'Something went wrong', code: ErrorCode.internalError })

    // The cause lands in the logs...
    expect(logged.length).toBe(1)
    expect(logged[0]).toMatch(/ECONNREFUSED/)
    // ...and never in the response body.
    expect(JSON.stringify(response.body).includes('ECONNREFUSED')).toBe(false)
  })

  it('a 5xx HttpError keeps its status and code but not its message', async () => {
    const { response, logged } = await captureConsole(() => get('/driver-failure'))

    expect(response.status).toBe(503)
    expect(response.body).toEqual({ error: 'Something went wrong', code: 'db-timeout' })
    expect(logged.length).toBe(1)
    expect(logged[0]).toMatch(/ETIMEDOUT/)
  })

  it('httpError.internal collapses to internal-error and still logs', async () => {
    const { response, logged } = await captureConsole(() => get('/internal-factory'))

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'Something went wrong', code: ErrorCode.internalError })
    expect(logged.length).toBe(1)
    expect(logged[0]).toMatch(/ECONNREFUSED/)
  })

  it('an unmatched route returns 404 not-found instead of a 500', async () => {
    const { status, body } = await get('/definitely-not-a-route')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Route not found', code: ErrorCode.notFound })
  })

  it("Elysia's throw status(n) keeps its status and derives the code", async () => {
    const bare = await get('/status-bare')

    expect(bare.status).toBe(401)
    expect(bare.body).toEqual({ error: 'Authentication required', code: ErrorCode.unauthorized })
  })

  it("throw status(n, body) keeps the route's own error body", async () => {
    const withBody = await get('/status-body')

    expect(withBody.status).toBe(403)
    expect(withBody.body).toEqual({ error: 'not an admin of this course', code: 'forbidden' })
  })

  it('a thrown status(422) answers the same body as Elysia validation', async () => {
    const { status: result, body } = await get('/status-validation')

    expect(result).toBe(422)
    expect(body).toEqual({
      error: VALIDATION_ERROR_MESSAGE,
      code: ErrorCode.validationError,
    })
  })

  it('an unmapped status keeps its status but answers internal-error', async () => {
    const { status: result, body } = await get('/status-unmapped')

    expect(result).toBe(429)
    expect(body).toEqual({ error: 'Request failed', code: ErrorCode.internalError })
  })
})
