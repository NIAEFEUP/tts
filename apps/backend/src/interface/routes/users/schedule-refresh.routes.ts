import { Elysia, t } from 'elysia'

import { createRefreshSchedule } from '@/application/use-cases/schedule/refresh-schedule'
import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import type { ScheduleSync } from '@/domain/ports/schedule-sync'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { httpError } from '@/interface/errors/errors'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'

export type ScheduleRefreshRoutesDeps = {
  sessions: SessionRepository
  sync: ScheduleSync
}

type ScheduleRefreshContext = {
  decorator: { repositories: { enrollmentRepository: EnrollmentRepository } }
  store: {}
  derive: {}
  resolve: {}
}

export const scheduleRefreshRoutes = ({ sessions, sync }: ScheduleRefreshRoutesDeps) =>
  new Elysia<'/v1/users/me', ScheduleRefreshContext>({ prefix: '/v1/users/me' })
    .model({ ApiError: t.Object({ error: t.String(), code: t.String() }) })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .put(
      '/schedule/refresh',
      async ({ user, repositories }) => {
        if (!user) throw httpError.unauthorized()
        const refresh = createRefreshSchedule({
          sync,
          enrollments: repositories.enrollmentRepository,
        })
        return refresh(user.id)
      },
      {
        response: {
          200: t.Object({ refreshed: t.Boolean(), enrollmentCount: t.Number() }),
          401: 'ApiError',
        },
        detail: { tags: ['users'], summary: 'Refresh my Sigarra enrollments' },
      },
    )
