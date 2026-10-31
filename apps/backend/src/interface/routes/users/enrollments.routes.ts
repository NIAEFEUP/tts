import { Elysia, t } from 'elysia'
import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { occurrenceSchema,slotSchema } from '@/interface/routes/users/schemas'
import { createAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { httpError } from '@/interface/errors/errors'

const enrollment = t.Object({
  occurrence: occurrenceSchema,
  class: t.Object({
    id: t.Number(),
    name: t.String(),
    vacancies: t.Union([t.Number(), t.Null()]),
    slots: t.Array(slotSchema),
  }),
})

type EnrollmentRoutesDeps = {
  decorator: { repositories: { enrollmentRepository: EnrollmentRepository } }
  store: {}
  derive: {}
  resolve: {}
}

export const enrollmentRoutes = (sessions: SessionRepository) =>
  new Elysia<'/v1/users/me', EnrollmentRoutesDeps>({ prefix: '/v1/users/me' })
    .model({ ApiError: t.Object({ error: t.String(), code: t.String() }) })
    .use(createAuthMiddleware({ resolveSession: sessions.resolve }))
    .get(
      '/enrollments',
      ({ user, repositories }) => {
        if (!user) throw httpError.unauthorized()
        return repositories.enrollmentRepository.findByUserId(user.id)
      },
      {
        response: { 200: t.Array(enrollment), 401: 'ApiError' },
        detail: { tags: ['users'], summary: 'List my class enrollments' },
      },
    )
