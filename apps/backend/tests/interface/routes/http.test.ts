import { describe, expect, it } from 'bun:test'

import { TEST_SESSION_TOKEN } from './support/auth-test-utils'
import { createRequester, request } from './support/http-test-utils'
import type { HttpApp } from './support/http-test-utils'

// Pins the contract of `support/http-test-utils`, which every route test builds
// on. The stub app records what it receives and answers with a fixed response,
// so these assertions describe the helper itself rather than a route.

function createStub(respond: () => Response) {
  const seen: Request[] = []
  const app: HttpApp = {
    handle: async (incoming) => {
      seen.push(incoming)
      return respond()
    },
  }

  return { app, seen }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('http test helpers', () => {
  it('defaults to an authenticated GET with the test session cookie', async () => {
    const { app, seen } = createStub(() => json({ ok: true }))

    const { status, contentType, body } = await request(app, '/v1/things')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual({ ok: true })
    expect(seen[0].method).toBe('GET')
    expect(seen[0].headers.get('cookie')).toBe(`session=${TEST_SESSION_TOKEN}`)
  })

  it('sends a JSON body with the matching content type', async () => {
    const { app, seen } = createStub(() => json({ id: 'x' }, 201))

    const { status, body } = await request(app, '/v1/things', { method: 'POST', body: { name: 'x' } })

    expect(status).toBe(201)
    expect(body).toEqual({ id: 'x' })
    expect(seen[0].headers.get('content-type')).toBe('application/json')
    expect(await seen[0].text()).toBe('{"name":"x"}')
  })

  it('omits the cookie when the caller is anonymous', async () => {
    const { app, seen } = createStub(() => json({}))

    await request(app, '/v1/things', { authenticated: false })

    expect(seen[0].headers.get('cookie')).toBeNull()
  })

  it('sends a forged cookie verbatim', async () => {
    const { app, seen } = createStub(() => json({}))

    await request(app, '/v1/things', { cookie: 'session=forged' })

    expect(seen[0].headers.get('cookie')).toBe('session=forged')
  })

  it('reads a 204 as a null body instead of throwing', async () => {
    const { app, seen } = createStub(() => new Response(null, { status: 204 }))

    const { status, body } = await request(app, '/v1/things/1', { method: 'DELETE' })

    expect(seen[0].method).toBe('DELETE')
    expect(status).toBe(204)
    expect(body).toBeNull()
  })

  it('reads a non-JSON error page as a null body instead of throwing', async () => {
    const { app } = createStub(
      () => new Response('<html>bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }),
    )

    const { status, contentType, body } = await request(app, '/v1/things')

    expect(status).toBe(502)
    expect(contentType).toBe('text/html')
    expect(body).toBeNull()
  })

  it('surfaces the Location of a created resource', async () => {
    const { app } = createStub(() => new Response(null, { status: 201, headers: { location: '/v1/things/1' } }))

    const { status, location } = await request(app, '/v1/things', { method: 'POST', body: {} })

    expect(status).toBe(201)
    expect(location).toBe('/v1/things/1')
  })

  it('binds one helper per method', async () => {
    const { app, seen } = createStub(() => json({}))
    const { get, post, put, patch, del } = createRequester(app)

    await get('/v1/a')
    await post('/v1/b', { body: {} })
    await put('/v1/c', { body: {} })
    await patch('/v1/d', { body: {} })
    await del('/v1/e')

    expect(seen.map((received) => received.method)).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  })
})
