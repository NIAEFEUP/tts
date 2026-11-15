import { Elysia, t } from 'elysia'

import type { ClassRepository } from '@/domain/ports/class.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { isAdmin } from '@/core/auth/user'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { HttpError, httpError } from '@/interface/errors/errors'
import { classWithSlotsSchema, enrolledStudentSchema } from './users/schemas'

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

export type ClassRoutesDeps = {
  sessions: SessionRepository
}

export const classRoutes = ({ sessions }: ClassRoutesDeps) =>
  new Elysia<'/v1/classes', ClassDependencies>({ prefix: '/v1/classes' })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .model({ ApiError: apiError })
    .get(
      '/:id',
      async ({ repositories, params }) => {
        const classRow = await repositories.classRepository.findById(params.id)
        if (!classRow) throw new HttpError('class-not-found', `Class ${params.id} not found`, 404)

        return {
          id: classRow.id,
          name: classRow.name,
          vacancies: classRow.vacancies,
          filteredTeachers: classRow.filteredTeachers,
          slots: classRow.slots,
        }
      },
      {
        response: { 200: classWithSlotsSchema, 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        detail: { tags: ['classes'], summary: 'Get one class' },
      },
    )
    .get(
      '/:id/students',
      async ({ repositories, params, user }) => {
        if (!user) throw httpError.unauthorized()
        if (!isAdmin(user)) throw httpError.forbidden()

        const students = await repositories.classRepository.findStudentsByClassId(params.id)
        if (!students) throw new HttpError('class-not-found', `Class ${params.id} not found`, 404)

        return students
      },
      {
        response: { 200: t.Array(enrolledStudentSchema), 401: 'ApiError', 403: 'ApiError', 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        detail: { tags: ['classes'], summary: 'List students enrolled in a class' },
      },
    )
