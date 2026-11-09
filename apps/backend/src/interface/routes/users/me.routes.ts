import { Elysia } from 'elysia'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { currentUserProfile } from '../session/current-user.handler'
import { sessionUser } from '../session/session.schemas'

export const meRoutes = ({ sessions }: { sessions: SessionRepository }) =>
  new Elysia({ prefix: '/v1/users' })
    .model({ ApiError: apiError })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .get('/me', currentUserProfile, {
      response: { 200: sessionUser, 401: 'ApiError' },
      detail: { tags: ['users'], summary: 'Current user' },
    })
