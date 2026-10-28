import { describe, expect, it } from 'bun:test'

import { createApp } from '@/main'

// Regression guard for issue #823 (I-2): the frontend talks to this backend
// cross-origin in dev (`localhost:3100` → `localhost:3000`) with credentials,
// so the two things it relies on are that `GET /health` answers and that CORS
// echoes the frontend origin. Both are wired in `main.ts`; this drives the real
// app through `createApp().handle(request)` — no listener, no database.

const app = createApp()

const preflight = (origin: string) =>
  app.handle(
    new Request('http://localhost:3000/v1/auth/me', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type',
      },
    }),
  )

describe('frontend integration', () => {
  it('GET /health answers for the frontend readiness check', async () => {
    const response = await app.handle(new Request('http://localhost:3000/health'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })

  it('CORS allows the frontend origin and permits credentials', async () => {
    const response = await preflight('http://localhost:3100')

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3100')
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('CORS does not allow an unlisted origin', async () => {
    const response = await preflight('http://evil.example')

    expect(response.headers.get('access-control-allow-origin')).toBe(null)
  })
})
