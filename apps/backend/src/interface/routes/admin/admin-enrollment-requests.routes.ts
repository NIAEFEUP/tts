import { Elysia, t } from 'elysia'

import { HttpError, httpError } from '@/interface/errors/errors'
import type {
  AdminEnrollmentRequestDecision,
  AdminEnrollmentRequestRepository,
} from '@/domain/ports/admin-enrollment-request.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { isAdmin } from '@/core/auth/user'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { adminEnrollmentRequestSchema } from '@/interface/routes/enrollment-requests/enrollment-requests.schemas'
import { toAdminEnrollmentRequestResponse } from '@/interface/routes/enrollment-requests/enrollment-requests.presenter'
import {
  adminEnrollmentRequestParamsSchema,
  adminEnrollmentRequestQuerySchema,
  parseActiveStates,
} from '@/interface/validators/admin-enrollment-request.validator'

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

/** Turns a decision outcome into the response body, or the matching HTTP error. */
function toDecisionResponse(result: AdminEnrollmentRequestDecision, id: string) {
  switch (result.kind) {
    case 'ok':
      return toAdminEnrollmentRequestResponse(result.request)
    case 'not-found':
      throw new HttpError('enrollment-request-not-found', `Enrollment request ${id} not found`, 404)
    case 'forbidden':
      throw httpError.forbidden()
    case 'not-pending':
      throw new HttpError(
        'enrollment-request-not-pending',
        `Enrollment request ${id} cannot be decided: it was already decided or withdrawn`,
        409,
      )
    case 'occurrence-has-no-classes':
      throw new HttpError(
        'occurrence-has-no-classes',
        `Enrollment request ${id} cannot be accepted: an occurrence to enroll in has no classes`,
        409,
      )
  }
}

export const adminEnrollmentRequestRoutes = ({ sessions }: AdminRoutesDeps) =>
  new Elysia<'/v1/admin/enrollment-requests', AdminDependencies>({
    prefix: '/v1/admin/enrollment-requests',
  })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .model({ ApiError: apiError })
    .model({
      EnrollmentRequestPage: t.Object({
        requests: t.Array(adminEnrollmentRequestSchema),
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

        const page = await repositories.adminEnrollmentRequestRepository.findForAdmin(user.id, {
          page: query.page ?? 1,
          pageSize: query.page_size ?? 20,
          activeCourse: query.activeCourse,
          activeCurricularYear: query.activeCurricularYear,
          activeStates: parseActiveStates(query.activeStates),
        })

        return {
          ...page,
          requests: page.requests.map(toAdminEnrollmentRequestResponse),
        }
      },
      {
        query: adminEnrollmentRequestQuerySchema,
        response: { 200: 'EnrollmentRequestPage', 400: 'ApiError', 401: 'ApiError', 403: 'ApiError', 422: 'ApiError' },
        detail: { tags: ['admin'], summary: 'List enrollment requests in my occurrence scope' },
      },
    )
    .post(
      '/:id/accept',
      async ({ repositories, user, params }) => {
        if (!user) throw httpError.unauthorized()
        if (!isAdmin(user)) throw httpError.forbidden()

        const result = await repositories.adminEnrollmentRequestRepository.acceptForAdmin(user.id, params.id)
        return toDecisionResponse(result, params.id)
      },
      {
        params: adminEnrollmentRequestParamsSchema,
        response: {
          200: adminEnrollmentRequestSchema,
          401: 'ApiError',
          403: 'ApiError',
          404: 'ApiError',
          409: 'ApiError',
        },
        detail: { tags: ['admin'], summary: 'Accept an enrollment request' },
      },
    )
    .post(
      '/:id/reject',
      async ({ repositories, user, params }) => {
        if (!user) throw httpError.unauthorized()
        if (!isAdmin(user)) throw httpError.forbidden()

        const result = await repositories.adminEnrollmentRequestRepository.rejectForAdmin(user.id, params.id)
        return toDecisionResponse(result, params.id)
      },
      {
        params: adminEnrollmentRequestParamsSchema,
        response: {
          200: adminEnrollmentRequestSchema,
          401: 'ApiError',
          403: 'ApiError',
          404: 'ApiError',
          409: 'ApiError',
        },
        detail: { tags: ['admin'], summary: 'Reject an enrollment request' },
      },
    )
