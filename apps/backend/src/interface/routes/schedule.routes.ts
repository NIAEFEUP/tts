import { Elysia } from 'elysia'

import type { SessionRepository } from '@/domain/ports/session.repository'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'

export type ScheduleRoutesDeps = {
  sessions: SessionRepository
}

export const scheduleRoutes = ({ sessions }: ScheduleRoutesDeps) =>
  new Elysia({ prefix: '/v1/users/me/schedule' })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    // GET /v1/users/me/schedule
    // por agora so devolve []
    .get('/', ({ user }) => {
      console.log('user s schedule', user?.id)
      return []
    })
