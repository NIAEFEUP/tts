import { Elysia, t } from 'elysia'

import { HttpError } from '@/interface/errors/errors'

import type { AdminRepository } from '@/domain/ports/admin.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { isAdmin } from '@/core/auth/user'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { courseSchema, occurrenceWithUnitSchema } from '../catalog.schemas'

// Two read-only views of what the signed-in admin can manage:
//
//   GET /v1/admin/courses      - courses in my AdminCourse scope
//   GET /v1/admin/occurrences  - occurrences in my AdminOccurrence scope
//
// No session gives 401 (auth middleware). A signed-in user who is not an
// admin gets 403. No scope gives an empty list.

type AdminDependencies = {
  decorator: {
    repositories: {
      adminRepository: AdminRepository
    }
  }
  store: {}
  derive: {}
  resolve: {}
}

export type AdminRoutesDeps = {
  sessions: SessionRepository
}

export const adminScopeRoutes = ({ sessions }: AdminRoutesDeps) =>
  new Elysia<'/v1/admin', AdminDependencies>({ prefix: '/v1/admin' })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .model({ ApiError: apiError })
    // GET /v1/admin/courses
    // Only reads AdminCourse. Being admin of a course says nothing about
    // its occurrences.
    .get(
      '/courses',
      async ({ repositories, user }) => {
        if (!user) throw new HttpError('unauthorized', 'Authentication required', 401)
        if (!isAdmin(user)) throw new HttpError('forbidden', 'Admin access required', 403)

        return repositories.adminRepository.findCoursesByAdmin(user.id)
      },
      {
        response: { 200: t.Array(courseSchema), 401: 'ApiError', 403: 'ApiError' },
        detail: { tags: ['admin'], summary: 'List courses I can administer' },
      },
    )
    // GET /v1/admin/occurrences
    // Only reads AdminOccurrence. The join with Occurrence must use both
    // id and year, because Sigarra reuses the same id across years.
    .get(
      '/occurrences',
      async ({ repositories, user }) => {
        if (!user) throw new HttpError('unauthorized', 'Authentication required', 401)
        if (!isAdmin(user)) throw new HttpError('forbidden', 'Admin access required', 403)

        return repositories.adminRepository.findOccurrencesByAdmin(user.id)
      },
      {
        response: { 200: t.Array(occurrenceWithUnitSchema), 401: 'ApiError', 403: 'ApiError' },
        detail: { tags: ['admin'], summary: 'List occurrences I can administer' },
      },
    )
