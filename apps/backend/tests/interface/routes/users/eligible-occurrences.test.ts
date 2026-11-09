import { expect, it } from 'bun:test'

import type { AuthUser } from '@/core/auth/user'
import type { EligibleOccurrenceRepository } from '@/domain/ports/eligible-occurrence.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createApp } from '@/main'

const USER: AuthUser = {
  id: 'up202012345',
  name: 'Ana Silva',
  email: 'up202012345@up.pt',
  role: 'USER',
}

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

let queriedUserId: string | null = null

const eligibleOccurrenceRepository: EligibleOccurrenceRepository = {
  async findByUserId(userId) {
    queriedUserId = userId
    return occurrences
  },
}

const sessionRepository: SessionRepository = {
  issue: async () => 'valid-session',
  resolve: async (token) => (token === 'valid-session' ? USER : null),
  revoke: async () => {},
}

const app = createApp({
  repositories: {
    eligibleOccurrenceRepository,
    sessionRepository,
  },
})

const getEligibleOccurrences = (cookie?: string) =>
  app.handle(
    new Request('http://localhost/v1/users/me/eligible-occurrences', {
      headers: cookie ? { cookie } : {},
    }),
  )

it('GET /users/me/eligible-occurrences returns the authenticated student eligible occurrences', async () => {
  const response = await getEligibleOccurrences('session=valid-session')

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(occurrences)
  expect(queriedUserId).toBe(USER.id)
})

it('GET /users/me/eligible-occurrences returns an empty list when the student has no enrollments', async () => {
  const emptyApp = createApp({
    repositories: {
      eligibleOccurrenceRepository: { findByUserId: async () => [] },
      sessionRepository,
    },
  })
  const response = await emptyApp.handle(
    new Request('http://localhost/v1/users/me/eligible-occurrences', {
      headers: { cookie: 'session=valid-session' },
    }),
  )

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual([])
})

it('GET /users/me/eligible-occurrences requires a valid session cookie', async () => {
  for (const cookie of [undefined, 'session=invalid-session']) {
    const response = await getEligibleOccurrences(cookie)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: 'Authentication required',
      code: 'unauthorized',
    })
  }
})
