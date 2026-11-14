import { describe, expect, it } from 'bun:test'
import type { EligibleOccurrenceRepository } from '@/domain/ports/eligible-occurrence.repository'
import { createApp } from '@/main'
import { TEST_SESSION_TOKEN, TEST_USER, createFakeSessions } from '../support/auth-test-utils'
import { UNAUTHORIZED_BODY } from '../support/catalog-test-utils'

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
  },
]

describe('eligible occurrences routes', () => {
  let queriedUserId: string | null = null

  const eligibleOccurrenceRepository: EligibleOccurrenceRepository = {
    async findByUserId(userId) {
      queriedUserId = userId
      return occurrences
    },
  }

  const app = createApp({
    repositories: {
      eligibleOccurrenceRepository,
      sessionRepository: createFakeSessions(),
    },
  })

  const getEligibleOccurrences = (cookie?: string) =>
    app.handle(
      new Request(`http://localhost${PATH}`, {
        headers: cookie ? { cookie } : {},
      }),
    )

  it('returns the authenticated student eligible occurrences', async () => {
    const response = await getEligibleOccurrences(`session=${TEST_SESSION_TOKEN}`)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(occurrences)
    expect(queriedUserId).toBe(TEST_USER.id)
  })

  it('returns an empty list when the student has no enrollments', async () => {
    const emptyApp = createApp({
      repositories: {
        eligibleOccurrenceRepository: { findByUserId: async () => [] },
        sessionRepository: createFakeSessions(),
      },
    })
    const response = await emptyApp.handle(
      new Request(`http://localhost${PATH}`, {
        headers: { cookie: `session=${TEST_SESSION_TOKEN}` },
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })

  it('requires a valid session cookie', async () => {
    for (const cookie of [undefined, 'session=invalid-session']) {
      const response = await getEligibleOccurrences(cookie)

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual(UNAUTHORIZED_BODY)
    }
  })
})
