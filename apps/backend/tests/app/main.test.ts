import { describe, expect, it } from 'bun:test'
import { createApp } from '@/main'

describe('app composition', () => {
  it('wires routes without decorator conflicts', async () => {
    const app = createApp()

    const health = await app.handle(new Request('http://localhost/health'))
    const root = await app.handle(new Request('http://localhost/'))

    expect(health.status).toBe(200)
    expect(root.status).toBe(200)
    expect(await root.json()).toEqual({ message: 'Hello from tts-be!' })
  })

  it('keeps public routes public and protects the catalog', async () => {
    const app = createApp()

    const health = await app.handle(new Request('http://localhost/health'))
    const me = await app.handle(new Request('http://localhost/v1/auth/me'))
    const faculties = await app.handle(new Request('http://localhost/v1/faculties'))

    // The session guard is scoped to the faculties instance, so it must not
    // leak into its siblings.
    expect(health.status).toBe(200)
    expect(me.status).toBe(200)
    expect(await me.json()).toEqual({ signed: false })
    expect(faculties.status).toBe(401)
  })
})
