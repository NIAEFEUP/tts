import { Elysia, t } from 'elysia'
import type { ClassRepository } from '@/domain/ports/class.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createAuthMiddleware, createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { HttpError, httpError } from '@/interface/errors/errors'
import { classWithSlotsSchema, enrolledStudentSchema } from './users/schemas'
import { isAdmin } from '@/core/auth/user'

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
        detail: { tags: ['classes'], summary: 'Get one class' },
      },
    )
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .get(
      '/:id/students',
      async ({ repositories, params, user }) => {
        if (!user) throw httpError.unauthorized()
        if (!isAdmin(user)) throw httpError.forbidden()

        const students = await repositories.classRepository.findStudentsByClassId(params.id)
        if (students == null) {
          throw new HttpError('class-not-found', `Class ${params.id} not found`, 404)
        }

        return students
      },
      {
        response: {
          200: t.Array(enrolledStudentSchema),
          401: 'ApiError',
          403: 'ApiError',
          404: 'ApiError',
        },
        params: t.Object({ id: t.Integer() }),
        detail: { tags: ['classes'], summary: 'Get students enrolled in a class' },
      },
    )
