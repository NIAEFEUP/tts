import { describe, expect, it } from 'bun:test'

import { ADMIN, createFakeSessions } from '../support/auth-test-utils'
import {
  CLASSES,
  CLASS_STUDENTS,
  VALIDATION_ERROR_BODY,
  createCatalogApp,
  registerCatalogAuthGuard,
} from '../support/catalog-test-utils'

const { app, get } = createCatalogApp()
const adminApp = createCatalogApp({ sessionRepository: createFakeSessions(ADMIN) })

describe('class routes', () => {
  registerCatalogAuthGuard(app, ['/v1/classes/501', '/v1/classes/501/students'])

  it('returns class details with slots and professors', async () => {
    const { status, contentType, body } = await get('/v1/classes/501')

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual({
      id: CLASSES[0].id,
      name: CLASSES[0].name,
      vacancies: CLASSES[0].vacancies,
      slots: CLASSES[0].slots,
    })
  })

  it('returns 404 for an unknown class', async () => {
    const { status, body } = await get('/v1/classes/99999')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Class 99999 not found', code: 'class-not-found' })
  })

  it('rejects a non-numeric class id with a validation error', async () => {
    const { status, body } = await get('/v1/classes/not-a-number')

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('denies class enrollment lists to non-admin users', async () => {
    const { status, body } = await get('/v1/classes/501/students')

    expect(status).toBe(403)
    expect(body).toEqual({ error: 'Not allowed', code: 'forbidden' })
  })

  it('allows admins to list enrolled students', async () => {
    const { status, body } = await adminApp.get('/v1/classes/501/students')

    expect(status).toBe(200)
    expect(body).toEqual(CLASS_STUDENTS[501])
  })

  it('returns an empty list when an existing class has no enrolled students', async () => {
    const { status, body } = await adminApp.get('/v1/classes/502/students')

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('returns 404 when an admin requests students for an unknown class', async () => {
    const { status, body } = await adminApp.get('/v1/classes/99999/students')

    expect(status).toBe(404)
    expect(body).toEqual({ error: 'Class 99999 not found', code: 'class-not-found' })
  })
})
