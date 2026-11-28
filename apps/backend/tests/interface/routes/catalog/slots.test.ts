import { describe, expect, it } from 'bun:test'

import {
  CLASSES,
  VALIDATION_ERROR_BODY,
  createCatalogApp,
  registerCatalogAuthGuard,
} from '../support/catalog-test-utils'

const { app, get } = createCatalogApp()

describe('slot routes', () => {
  registerCatalogAuthGuard(app, ['/v1/slots/901', '/v1/slots/901/professors'])

  it('returns slot details and the classes sharing the slot', async () => {
    const { status, contentType, body } = await get('/v1/slots/901')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual({
      ...CLASSES[0].slots[0],
      classes: [{ id: 501, name: '1LEIC01' }],
    })
  })

  it('lists every class using a shared slot in the slot detail response', async () => {
    const sharedClass = {
      ...CLASSES[0],
      id: 504,
      name: '1LEIC02',
      slots: [CLASSES[0].slots[0]],
    }
    const { get: getWithSharedClass } = createCatalogApp({ classes: [...CLASSES, sharedClass] })
    const { status, body } = await getWithSharedClass('/v1/slots/901')

    expect(status).toBe(200)
    expect(body).toMatchObject({
      id: 901,
      classes: [
        { id: 501, name: '1LEIC01' },
        { id: 504, name: '1LEIC02' },
      ],
    })
  })

  it('returns the professors assigned to a slot', async () => {
    const { status, body } = await get('/v1/slots/901/professors')

    expect(status).toBe(200)
    expect(body).toEqual(CLASSES[0].slots[0].professors)
  })

  it('returns 404 for an unknown slot', async () => {
    const detail = await get('/v1/slots/99999')
    const professors = await get('/v1/slots/99999/professors')

    expect(detail.status).toBe(404)
    expect(detail.body).toEqual({ error: 'Schedule slot 99999 not found', code: 'slot-not-found' })
    expect(professors.status).toBe(404)
    expect(professors.body).toEqual({ error: 'Schedule slot 99999 not found', code: 'slot-not-found' })
  })

  it('rejects a non-numeric slot id', async () => {
    const { status, body } = await get('/v1/slots/not-a-number')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })
})
