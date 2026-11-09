import { Elysia } from 'elysia'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { sessionUser } from '../auth/auth.schemas'
import { currentUserProfile } from '../auth/current-user.handler'

export const meRoutes = ({ sessions }: { sessions: SessionRepository }) =>
  new Elysia({ prefix: '/v1/users' })
    .model({ ApiError: apiError })
    .use(createAuthMiddleware({ resolveSession: sessions.resolve }))
    .get('/me', currentUserProfile, {
      response: { 200: sessionUser, 401: 'ApiError' },
      detail: { tags: ['users'], summary: 'Current user' },
    })
