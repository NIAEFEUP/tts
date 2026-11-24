// Elysia is the web framework; `t` is its schema validator (like Zod).
import { Elysia, status, t } from 'elysia'

// HttpError is a custom error class; the global error handler catches it and
// returns clean JSON responses with the right status code.
import { HttpError, httpError } from '@/interface/errors/errors'

// The ports define *what* methods exist — not *how* they work.
// Imported as `type` only: the route never touches the database directly.
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type {
  ExchangePeriodsRepository,
  ExchangePeriod,
  ExchangePeriodWriteResult,
} from '@/domain/ports/exchange-period.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { ClassRepository } from '@/domain/ports/class.repository'
import type { AdminRepository } from '@/domain/ports/admin.repository'
import { isAdmin } from '@/core/auth/user'
import { createCreateExchangeOccurrencePeriod } from '@/application/use-cases/exchange/create-exchange-period'
import { createUpdateExchangeOccurrencePeriod } from '@/application/use-cases/exchange/update-exchange-occurrence-period'
import { createDeleteOccurrencePeriod } from '@/application/use-cases/exchange/delete-exchange-occurrence-period'
import type { OccurrencePeriodFailure } from '@/application/use-cases/exchange/exchange-period-common'

import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import {
  createExchangePeriodSchema,
  exchangePeriodSchema,
  occurrenceWithUnitSchema,
  updateExchangePeriodSchema,
} from './catalog.schemas'
import { classWithSlotsSchema } from './users/schemas'

const occurrenceWithClassesSchema = t.Composite([
  occurrenceWithUnitSchema,
  t.Object({ classes: t.Array(classWithSlotsSchema) }),
])

function presentPeriod(period: ExchangePeriod) {
  return {
    id: period.id,
    occurrenceId: period.occurrenceId,
    occurrenceYear: period.occurrenceYear,
    startsAt: period.startsAt.toISOString(),
    endsAt: period.endsAt.toISOString(),
  }
}

function occurrenceNotFound(occurrenceId: number) {
  return new HttpError('occurrence-not-found', `Occurrence ${occurrenceId} not found`, 404)
}

function exchangePeriodNotFound(periodId: string) {
  return new HttpError('exchange-period-not-found', `Exchange period ${periodId} not found`, 404)
}

function authorisationError(failure: OccurrencePeriodFailure, occurrenceId: number): HttpError {
  switch (failure.kind) {
    case 'forbidden':
      return httpError.forbidden()
    case 'invalid-period-range':
      return new HttpError('invalid-period-range', 'startsAt must be before endsAt', 400)
    case 'occurrence-not-found':
      return occurrenceNotFound(occurrenceId)
  }
}

function writeError(result: ExchangePeriodWriteResult, subject: string): HttpError {
  switch (result.kind) {
    case 'overlap':
      return new HttpError('exchange-period-overlap', `Exchange period for ${subject} overlaps another period`, 409)
    case 'not-found':
      return exchangePeriodNotFound(subject)
    case 'pending-requests':
      return new HttpError(
        'exchange-period-has-pending-requests',
        `Exchange period for ${subject} has pending enrollment requests`,
        409,
      )
    default:
      return httpError.internal()
  }
}

function periodUseCases(repositories: OccurrenceRepositories) {
  const deps = {
    admins: repositories.adminRepository,
    occurrences: repositories.occurrenceRepository,
    periods: repositories.exchangePeriodsRepository,
  }

  return {
    create: createCreateExchangeOccurrencePeriod(deps),
    update: createUpdateExchangeOccurrencePeriod(deps),
    remove: createDeleteOccurrencePeriod(deps),
  }
}

// Occurrences are the concrete (course unit, course, academic year) tuples —
// the place where a course unit is actually taught. The read routes expose the
// occurrence, its exchange periods, and its classes; the write routes let a
// scoped admin manage those periods.
//
// All routes are behind a session (`?`): anonymous callers get a 401 before the
// handler runs. Write routes additionally require an admin role and a scope
// row for the occurrence or course they address.

// Elysia does not propagate a parent instance's `decorate` types into a
// standalone plugin, so the dependency is declared on the instance's own type.
// `use()` still merges the parent's decoration at runtime.
// This tells TypeScript: "this plugin expects `occurrenceRepository` to be
// available on the Elysia context."
type OccurrenceRepositories = {
  classRepository: ClassRepository
  occurrenceRepository: OccurrenceRepository
  exchangePeriodsRepository: ExchangePeriodsRepository
  adminRepository: AdminRepository
}

type OccurrenceDependencies = {
  decorator: {
    repositories: OccurrenceRepositories
  }
  store: {}
  derive: {}
  resolve: {}
}

export type OccurrenceRoutesDeps = {
  sessions: SessionRepository
}

export const occurrenceRoutes = ({ sessions }: OccurrenceRoutesDeps) =>
  new Elysia<'/v1/occurrences', OccurrenceDependencies>({ prefix: '/v1/occurrences' })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    // `404: 'ApiError'` below references a named model. Elysia resolves model
    // names per-instance, so it must be registered here too — the app-level
    // registration in `openapiPlugin` is only visible when `use()`d as a parent
    // (and it is skipped entirely in production).
    .model({ ApiError: apiError })
    // GET /v1/occurrences/587177?year=2025
    // Returns a single occurrence enriched with its course unit's name,
    // acronym, and curricular year. `year` is required because the occurrence id alone is not
    // unique — Sigarra reuses the same id across academic years, so the real
    // key is the composite `(id, year)`. An unknown (id, year) pair throws
    // HttpError → 404.
    .get(
      '/:id',
      async ({ repositories, params, query }) => {
        const occurrence = await repositories.occurrenceRepository.findById(params.id, query.year)
        if (!occurrence) throw new HttpError('occurrence-not-found', `Occurrence ${params.id} not found`, 404)

        return occurrence
      },
      {
        response: { 200: occurrenceWithUnitSchema, 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        query: t.Object({ year: t.Integer() }),
        detail: { tags: ['occurrences'], summary: 'Get one occurrence' },
      },
    )
    // GET /v1/occurrences/587177/periods?year=2025
    // Returns the exchange periods of one occurrence, ordered by `startsAt`.
    // Sigarra can reuse the same id across academic years, so the real key
    // is (id, year). An unknown (id, year) pair is a 404;
    // An occurrence that exists but has no periods returns `[]`.
    .get(
      '/:id/periods',
      async ({ repositories, params, query }) => {
        const occurrence = await repositories.occurrenceRepository.findById(params.id, query.year)
        if (!occurrence) throw new HttpError('occurrence-not-found', `Occurrence ${params.id} not found`, 404)

        const periods = await repositories.exchangePeriodsRepository.findByOccurrence(params.id, query.year)
        return periods.map((period) => ({
          ...period,
          startsAt: period.startsAt.toISOString(),
          endsAt: period.endsAt.toISOString(),
        }))
      },
      {
        response: { 200: t.Array(exchangePeriodSchema), 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        query: t.Object({ year: t.Integer() }),
        detail: { tags: ['occurrences'], summary: 'List exchange periods' },
      },
    )
    .get(
      '/:id/classes',
      async ({ repositories, params, query }) => {
        const occurrence = await repositories.occurrenceRepository.findById(params.id, query.year)
        if (!occurrence) throw new HttpError('occurrence-not-found', `Occurrence ${params.id} not found`, 404)

        const classes = await repositories.classRepository.findByOccurrence(params.id, query.year)
        return {
          ...occurrence,
          classes: classes.map((classRow) => ({
            id: classRow.id,
            name: classRow.name,
            vacancies: classRow.vacancies,
            filteredTeachers: classRow.filteredTeachers,
            slots: classRow.slots,
          })),
        }
      },
      {
        response: { 200: occurrenceWithClassesSchema, 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        query: t.Object({ year: t.Integer() }),
        detail: { tags: ['occurrences'], summary: 'Get occurrence with classes' },
      },
    )
    .post(
      '/:id/periods',
      async ({ repositories, user, params, query, body }) => {
        if (!user) throw httpError.unauthorized()
        if (!isAdmin(user)) throw httpError.forbidden()

        const result = await periodUseCases(repositories).create({
          user,
          occurrenceId: params.id,
          occurrenceYear: query.year,
          startsAt: new Date(body.startsAt),
          endsAt: new Date(body.endsAt),
        })

        switch (result.kind) {
          case 'forbidden':
          case 'invalid-period-range':
          case 'occurrence-not-found':
            throw authorisationError(result, params.id)
          case 'not-found':
            throw occurrenceNotFound(params.id)
          case 'overlap':
          case 'pending-requests':
            throw writeError(result, String(params.id))
          case 'created':
            break
        }

        return status(201, presentPeriod(result.period))
      },
      {
        params: t.Object({ id: t.Integer() }),
        query: t.Object({ year: t.Integer() }),
        body: createExchangePeriodSchema,
        response: {
          201: exchangePeriodSchema,
          400: 'ApiError',
          401: 'ApiError',
          403: 'ApiError',
          404: 'ApiError',
          409: 'ApiError',
        },
        detail: { tags: ['occurrences'], summary: 'Create an exchange period' },
      },
    )
    .put(
      '/:id/periods/:periodId',
      async ({ repositories, user, params, body }) => {
        if (!user) throw httpError.unauthorized()
        if (!isAdmin(user)) throw httpError.forbidden()

        const period = await repositories.exchangePeriodsRepository.findById(params.periodId)
        if (!period || period.occurrenceId !== params.id) throw exchangePeriodNotFound(params.periodId)

        const result = await periodUseCases(repositories).update({
          user,
          occurrenceId: params.id,
          occurrenceYear: period.occurrenceYear,
          periodId: params.periodId,
          startsAt: new Date(body.startsAt),
          endsAt: new Date(body.endsAt),
        })

        switch (result.kind) {
          case 'forbidden':
          case 'invalid-period-range':
          case 'occurrence-not-found':
            throw authorisationError(result, params.id)
          case 'overlap':
          case 'not-found':
          case 'pending-requests':
            throw writeError(result, params.periodId)
          case 'updated':
            break
        }

        return presentPeriod(result.period)
      },
      {
        params: t.Object({ id: t.Integer(), periodId: t.String() }),
        body: updateExchangePeriodSchema,
        response: {
          200: exchangePeriodSchema,
          400: 'ApiError',
          401: 'ApiError',
          403: 'ApiError',
          404: 'ApiError',
          409: 'ApiError',
        },
        detail: { tags: ['occurrences'], summary: 'Update an exchange period' },
      },
    )
    .delete(
      '/:id/periods/:periodId',
      async ({ repositories, user, params }) => {
        if (!user) throw httpError.unauthorized()
        if (!isAdmin(user)) throw httpError.forbidden()

        const period = await repositories.exchangePeriodsRepository.findById(params.periodId)
        if (!period || period.occurrenceId !== params.id) throw exchangePeriodNotFound(params.periodId)

        const result = await periodUseCases(repositories).remove({
          user,
          occurrenceId: params.id,
          occurrenceYear: period.occurrenceYear,
          periodId: params.periodId,
        })

        switch (result.kind) {
          case 'forbidden':
          case 'invalid-period-range':
          case 'occurrence-not-found':
            throw authorisationError(result, params.id)
          case 'overlap':
          case 'not-found':
          case 'pending-requests':
            throw writeError(result, params.periodId)
          case 'deleted':
            break
        }

        return status(204)
      },
      {
        params: t.Object({ id: t.Integer(), periodId: t.String() }),
        response: {
          204: t.Void(),
          401: 'ApiError',
          403: 'ApiError',
          404: 'ApiError',
          409: 'ApiError',
        },
        detail: { tags: ['occurrences'], summary: 'Delete an exchange period' },
      },
    )
