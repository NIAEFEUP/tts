import { Elysia, status, t } from 'elysia'

import { createCreateEnrollmentRequest } from '@/application/use-cases/enrollment-requests/create-enrollment-request'
import type { CreateEnrollmentRequestFailure } from '@/application/use-cases/enrollment-requests/create-enrollment-request'
import { createWithdrawEnrollmentRequest } from '@/application/use-cases/enrollment-requests/withdraw-enrollment-request'
import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import type { EnrollmentRequestRepository } from '@/domain/ports/enrollment-request.repository'
import type { ExchangePeriodsRepository } from '@/domain/ports/exchange-period.repository'
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { HttpError, httpError } from '@/interface/errors/errors'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { createEnrollmentRequestSchema, enrollmentRequestSchema } from './enrollment-requests.schemas'
import { toEnrollmentRequestResponse } from './enrollment-requests.presenter'

type EnrollmentRequestDependencies = {
  decorator: {
    repositories: {
      enrollmentRequestRepository: EnrollmentRequestRepository
      enrollmentRepository: EnrollmentRepository
      occurrenceRepository: OccurrenceRepository
      exchangePeriodsRepository: ExchangePeriodsRepository
    }
  }
  store: {}
  derive: {}
  resolve: {}
}

export type EnrollmentRequestRoutesDeps = {
  sessions: SessionRepository
}

/** Turns a creation rule failure into the matching HTTP error. */
function toHttpError(failure: CreateEnrollmentRequestFailure): HttpError {
  switch (failure.kind) {
    case 'empty-options':
      return new HttpError('empty-enrollment-request', 'At least one option is required', 400)
    case 'duplicate-option':
      return new HttpError(
        'duplicate-enrollment-option',
        `Occurrence ${failure.occurrenceId} in ${failure.occurrenceYear} appears more than once`,
        400,
      )
    case 'occurrence-not-found':
      return new HttpError(
        'occurrence-not-found',
        `Occurrence ${failure.occurrenceId} in ${failure.occurrenceYear} was not found`,
        404,
      )
    case 'exchange-period-closed':
      return new HttpError(
        'exchange-period-closed',
        `The exchange period is closed for occurrence ${failure.occurrenceId} in ${failure.occurrenceYear}`,
        400,
      )
    case 'duplicate-request':
      return new HttpError(
        'duplicate-enrollment-request',
        `An enrollment request already exists for occurrence ${failure.occurrenceId} in ${failure.occurrenceYear}`,
        400,
      )
    case 'already-enrolled':
      return new HttpError(
        'already-enrolled',
        `You are already enrolled in occurrence ${failure.occurrenceId} in ${failure.occurrenceYear}`,
        400,
      )
  }
}

export const enrollmentRequestRoutes = ({ sessions }: EnrollmentRequestRoutesDeps) =>
  new Elysia<'/v1/enrollment-requests', EnrollmentRequestDependencies>({
    prefix: '/v1/enrollment-requests',
  })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    // Named model resolved per instance, like the other route groups: a route
    // that references `'ApiError'` in its response map needs it registered here.
    .model({ ApiError: apiError })
    // GET /v1/enrollment-requests
    .get(
      '/',
      async ({ user, repositories }) => {
        if (!user) throw httpError.unauthorized()
        const requests = await repositories.enrollmentRequestRepository.findByUserId(user.id)
        return requests.map(toEnrollmentRequestResponse)
      },
      {
        response: { 200: t.Array(enrollmentRequestSchema), 401: 'ApiError' },
        detail: { tags: ['enrollment-requests'], summary: 'List my enrollment requests' },
      },
    )
    // POST /v1/enrollment-requests
    .post(
      '/',
      async ({ user, repositories, body }) => {
        if (!user) throw httpError.unauthorized()

        const createEnrollmentRequest = createCreateEnrollmentRequest({
          enrollmentRequests: repositories.enrollmentRequestRepository,
          enrollments: repositories.enrollmentRepository,
          occurrences: repositories.occurrenceRepository,
          periods: repositories.exchangePeriodsRepository,
        })

        const result = await createEnrollmentRequest(user.id, body.options)
        if (result.kind !== 'ok') throw toHttpError(result)

        return status(201, toEnrollmentRequestResponse(result.request))
      },
      {
        body: createEnrollmentRequestSchema,
        response: {
          201: enrollmentRequestSchema,
          400: 'ApiError',
          401: 'ApiError',
          404: 'ApiError',
        },
        detail: { tags: ['enrollment-requests'], summary: 'Submit an enrollment or drop request' },
      },
    )
    // GET /v1/enrollment-requests/:id
    .get(
      '/:id',
      async ({ user, repositories, params }) => {
        if (!user) throw httpError.unauthorized()

        const request = await repositories.enrollmentRequestRepository.findById(params.id)
        if (!request) {
          throw new HttpError('enrollment-request-not-found', `Enrollment request ${params.id} not found`, 404)
        }
        if (request.userId !== user.id) throw httpError.forbidden()

        return toEnrollmentRequestResponse(request)
      },
      {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        response: { 200: enrollmentRequestSchema, 401: 'ApiError', 403: 'ApiError', 404: 'ApiError' },
        detail: { tags: ['enrollment-requests'], summary: 'Get one of my enrollment requests' },
      },
    )
    // DELETE /v1/enrollment-requests/:id
    .delete(
      '/:id',
      async ({ user, repositories, params }) => {
        if (!user) throw httpError.unauthorized()

        const withdrawEnrollmentRequest = createWithdrawEnrollmentRequest({
          enrollmentRequests: repositories.enrollmentRequestRepository,
        })

        const result = await withdrawEnrollmentRequest(user.id, params.id)
        switch (result.kind) {
          case 'ok':
            return status(204)
          case 'not-found':
            throw new HttpError('enrollment-request-not-found', `Enrollment request ${params.id} not found`, 404)
          case 'forbidden':
            throw httpError.forbidden()
          case 'not-pending':
            throw new HttpError(
              'enrollment-request-not-pending',
              'Only pending enrollment requests can be withdrawn',
              409,
            )
        }
      },
      {
        params: t.Object({ id: t.String({ minLength: 1 }) }),
        response: {
          204: t.Void(),
          401: 'ApiError',
          403: 'ApiError',
          404: 'ApiError',
          409: 'ApiError',
        },
        detail: { tags: ['enrollment-requests'], summary: 'Withdraw an enrollment request' },
      },
    )
