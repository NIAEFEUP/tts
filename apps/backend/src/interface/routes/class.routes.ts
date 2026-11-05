import { Elysia, t } from 'elysia'
import type { ClassRepository } from '@/domain/ports/class.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { HttpError } from '@/interface/errors/errors'
import { classWithSlotsSchema } from './users/schemas'

type ClassDependencies = {
  decorator: {
    repositories: {
      classRepository: ClassRepository
    }
  }
  store: {}
  derive: {}
  resolve: {}
}

export const classRoutes = (sessions: SessionRepository) =>
  new Elysia<'/v1/classes', ClassDependencies>({ prefix: '/v1/classes' })
    .model({ ApiError: t.Object({ error: t.String(), code: t.String() }) })
    .use(createAuthMiddleware({ resolveSession: sessions.resolve }))
    .get(
      '/:id',
      async ({ repositories, params }) => {
        const classInfo = await repositories.classRepository.findById(params.id)
        if (!classInfo) {
          throw new HttpError('class-not-found', `Class ${params.id} not found`, 404)
        }

        return classInfo
      },
      {
        response: { 200: classWithSlotsSchema, 401: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        detail: { tags: ['class'], summary: 'Get one class' },
      },
    )
