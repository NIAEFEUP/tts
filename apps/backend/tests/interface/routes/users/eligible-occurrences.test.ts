import { describe, expect, it } from 'bun:test'

import { TEST_USER } from '../support/auth-test-utils'
import { UNAUTHORIZED_BODY } from '../support/catalog-test-utils'
import { createUsersApp } from '../support/user-test-utils'

const PATH = '/v1/users/me/eligible-occurrences'

const occurrences = [
  {
    id: 12345,
    courseUnitId: 42,
    courseId: 22841,
    year: 2025,
    ects: 6,
    url: 'https://sigarra.up.pt/feup/pt/ucurr_geral.ficha_uc_view?pv_ocorrencia_id=12345',
    hash: 'occurrence-hash',
    acronym: 'BD',
    name: 'Bases de Dados',
    courseUnitYear: 2,
  },
]

describe('eligible occurrences routes', () => {
  let queriedUserId: string | null = null

  const { get } = createUsersApp(undefined, {
    async findByUserId(userId) {
      queriedUserId = userId
      return occurrences
    },
  })

  it('returns the authenticated student eligible occurrences', async () => {
    const { status, body } = await get(PATH)

    expect(status).toBe(200)
    expect(body).toEqual(occurrences)
    expect(queriedUserId).toBe(TEST_USER.id)
  })

  it('returns an empty list when the student has no enrollments', async () => {
    const { get: getEmpty } = createUsersApp(undefined, { findByUserId: async () => [] })
    const { status, body } = await getEmpty(PATH)

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('requires a valid session cookie', async () => {
    for (const cookie of [null, 'session=invalid-session']) {
      const { status, body } = await get(PATH, { cookie })

      expect(status).toBe(401)
      expect(body).toEqual(UNAUTHORIZED_BODY)
    }
  })
})
