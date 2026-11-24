import { Elysia, t } from 'elysia'

import { HttpError, httpError } from '@/interface/errors/errors'
import type { AdminEnrollmentRequestRepository } from '@/domain/ports/admin-enrollment-request.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { isAdmin } from '@/core/auth/user'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { enrollmentRequestSchema } from '../enrollment-requests/enrollment-requests.schemas'
import { toEnrollmentRequestResponse } from '../enrollment-requests/enrollment-requests.presenter'

type AdminDependencies = {
  decorator: {
    repositories: {
      adminEnrollmentRequestRepository: AdminEnrollmentRequestRepository
    }
  }
  store: {}
  derive: {}
  resolve: {}
}

export type AdminRoutesDeps = {
  sessions: SessionRepository
}

export const adminEnrollmentRequestRoutes = ({ sessions }: AdminRoutesDeps) =>
  new Elysia<'/v1/admin/enrollment-requests', AdminDependencies>({
    prefix: '/v1/admin/enrollment-requests',
  })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .model({ ApiError: apiError })
    .model({
      EnrollmentRequestPage: t.Object({
        requests: t.Array(enrollmentRequestSchema),
        page: t.Integer(),
        pageSize: t.Integer(),
        total: t.Integer(),
        totalPages: t.Integer(),
      }),
    })
    .get(
      '/',
      async ({ repositories, user, query }) => {
        if (!user) throw httpError.unauthorized()
        if (!isAdmin(user)) throw httpError.forbidden()

        const activeStates = query.activeStates
          ? query.activeStates.split(',').filter((state) => state.length > 0)
          : undefined
        const page = await repositories.adminEnrollmentRequestRepository.findForAdmin(user.id, {
          page: query.page ?? 1,
          pageSize: query.page_size ?? 20,
          activeCourse: query.activeCourse,
          activeCurricularYear: query.activeCurricularYear,
          activeStates,
        })

        return {
          ...page,
          requests: page.requests.map(toEnrollmentRequestResponse),
        }
      },
      {
        query: t.Object({
          page: t.Optional(t.Integer({ minimum: 1, default: 1 })),
          page_size: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 20 })),
          activeCourse: t.Optional(t.Integer()),
          activeCurricularYear: t.Optional(t.Integer()),
          activeStates: t.Optional(t.String()),
        }),
        response: { 200: 'EnrollmentRequestPage', 401: 'ApiError', 403: 'ApiError' },
        detail: { tags: ['admin'], summary: 'List enrollment requests in my occurrence scope' },
      },
    )
    .post(
      '/:id/accept',
      async ({ repositories, user, params }) => {
        if (!user) throw httpError.unauthorized()
        if (!isAdmin(user)) throw httpError.forbidden()

        const result = await repositories.adminEnrollmentRequestRepository.acceptForAdmin(user.id, params.id)

        switch (result.kind) {
          case 'ok':
            return toEnrollmentRequestResponse(result.request)
          case 'not-found':
            throw new HttpError('enrollment-request-not-found', `Enrollment request ${params.id} not found`, 404)
          case 'forbidden':
            throw httpError.forbidden()
          case 'not-pending':
            throw new HttpError(
              'enrollment-request-not-pending',
              'Only pending enrollment requests can be decided',
              409,
            )
        }
      },
      {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        response: { 200: enrollmentRequestSchema, 401: 'ApiError', 403: 'ApiError', 404: 'ApiError', 409: 'ApiError' },
        detail: { tags: ['admin'], summary: 'Accept an enrollment request' },
      },
    )
    .post(
      '/:id/reject',
      async ({ repositories, user, params }) => {
        if (!user) throw httpError.unauthorized()
        if (!isAdmin(user)) throw httpError.forbidden()

        const result = await repositories.adminEnrollmentRequestRepository.rejectForAdmin(user.id, params.id)

        switch (result.kind) {
          case 'ok':
            return toEnrollmentRequestResponse(result.request)
          case 'not-found':
            throw new HttpError('enrollment-request-not-found', `Enrollment request ${params.id} not found`, 404)
          case 'forbidden':
            throw httpError.forbidden()
          case 'not-pending':
            throw new HttpError(
              'enrollment-request-not-pending',
              'Only pending enrollment requests can be decided',
              409,
            )
        }
      },
      {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        response: { 200: enrollmentRequestSchema, 401: 'ApiError', 403: 'ApiError', 404: 'ApiError', 409: 'ApiError' },
        detail: { tags: ['admin'], summary: 'Reject an enrollment request' },
      },
    )
