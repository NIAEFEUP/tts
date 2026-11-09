import { Elysia, t } from 'elysia'
import type { EligibleOccurrenceRepository } from '@/domain/ports/eligible-occurrence.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { occurrenceWithUnitSchema } from '../catalog.schemas'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { httpError } from '@/interface/errors/errors'

type EligibleOccurrenceRoutesDeps = {
  decorator: { repositories: { eligibleOccurrenceRepository: EligibleOccurrenceRepository } }
  store: {}
  derive: {}
  resolve: {}
}

export const eligibleOccurrencesRoutes = (sessions: SessionRepository) =>
  new Elysia<'/v1/users/me', EligibleOccurrenceRoutesDeps>({ prefix: '/v1/users/me' })
    .model({ ApiError: t.Object({ error: t.String(), code: t.String() }) })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .get(
      '/eligible-occurrences',
      ({ user, repositories }) => {
        if (!user) throw httpError.unauthorized()
        return repositories.eligibleOccurrenceRepository.findByUserId(user.id)
      },
      {
        response: { 200: t.Array(occurrenceWithUnitSchema), 401: 'ApiError' },
        detail: { tags: ['users'], summary: 'List occurrences I can exchange into' },
      },
    )
