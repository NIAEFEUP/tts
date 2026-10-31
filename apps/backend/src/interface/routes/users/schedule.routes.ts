import { Elysia, t } from 'elysia'

import { createGetSchedule } from '@/application/use-cases/schedule/get-schedule'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import { scheduleEntrySchema } from '@/interface/routes/users/schemas'
import { httpError } from '@/interface/errors/errors'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'

export type ScheduleRoutesDeps = {
  sessions: SessionRepository
}

type ScheduleRoutesContext = {
  decorator: { repositories: { enrollmentRepository: EnrollmentRepository } }
  store: {}
  derive: {}
  resolve: {}
}

export const scheduleRoutes = ({ sessions }: ScheduleRoutesDeps) =>
  new Elysia<'/v1/users/me', ScheduleRoutesContext>({ prefix: '/v1/users/me' })
    .model({ ApiError: t.Object({ error: t.String(), code: t.String() }) })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .get(
      '/schedule',
      ({ user, repositories }) => {
        if (!user) throw httpError.unauthorized()
        const getSchedule = createGetSchedule({ enrollments: repositories.enrollmentRepository })
        return getSchedule(user.id)
      },
      {
        response: { 200: t.Array(scheduleEntrySchema), 401: 'ApiError' },
        detail: { tags: ['users'], summary: 'Get my class schedule' },
      },
    )
