import { Elysia, t } from 'elysia'

import { createGetSchedule } from '@/application/use-cases/schedule/get-schedule'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import { httpError } from '@/interface/errors/errors'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'

const professorSchema = t.Object({
  id: t.Number(),
  acronym: t.Nullable(t.String()),
  name: t.Nullable(t.String()),
})

const slotSchema = t.Object({
  id: t.Number(),
  lessonType: t.String(),
  dayOfWeek: t.Number(),
  startMinute: t.Number(),
  durationMin: t.Number(),
  location: t.Nullable(t.String()),
  professors: t.Array(professorSchema),
})

const scheduleEntrySchema = t.Object({
  classId: t.Number(),
  className: t.String(),
  occurrence: t.Object({
    id: t.Number(),
    year: t.Number(),
    courseUnit: t.Object({
      id: t.Number(),
      acronym: t.String(),
      name: t.String(),
      semester: t.Number(),
    }),
  }),
  slots: t.Array(slotSchema),
})

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
