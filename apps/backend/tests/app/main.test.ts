import { describe, expect, it } from 'bun:test'
import { createApp } from '@/main'
import { UNAUTHORIZED_BODY } from '../interface/routes/support/catalog-test-utils'

describe('app composition', () => {
  it('wires routes without decorator conflicts', async () => {
    const app = createApp()

    const health = await app.handle(new Request('http://localhost/health'))
    const root = await app.handle(new Request('http://localhost/'))

    expect(health.status).toBe(200)
    expect(root.status).toBe(200)
    expect(await root.json()).toEqual({ message: 'Hello from tts-be!' })
  })

  it('keeps public routes public and protects the catalog and /me', async () => {
    const app = createApp()

    const health = await app.handle(new Request('http://localhost/health'))
    const logout = await app.handle(new Request('http://localhost/v1/auth/logout', { method: 'POST' }))
    const me = await app.handle(new Request('http://localhost/v1/auth/me'))
    const faculties = await app.handle(new Request('http://localhost/v1/faculties'))

    // The session guard is scoped to the protected instances, so it must not
    // leak into public siblings (`health`, `logout`).
    expect(health.status).toBe(200)
    expect(logout.status).toBe(200)
    expect(await logout.json()).toEqual({ signed: false })
    expect(me.status).toBe(401)
    expect(await me.json()).toEqual(UNAUTHORIZED_BODY)
    expect(faculties.status).toBe(401)
  })
})
