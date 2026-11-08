// Elysia is the web framework; `t` is its schema validator (like Zod).
import { Elysia, t } from 'elysia'

// HttpError is a custom error class; the global error handler catches it and
// returns clean JSON responses with the right status code.
import { HttpError } from '@/interface/errors/errors'

// The ports define *what* methods exist — not *how* they work.
// Imported as `type` only: the route never touches the database directly.
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { ExchangePeriodsRepository } from '@/domain/ports/exchange-period.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { ClassRepository } from '@/domain/ports/class.repository'

import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { exchangePeriodSchema, occurrenceWithUnitSchema } from './catalog.schemas'
import { classWithSlotsSchema } from './users/schemas'

const occurrenceWithClassesSchema = t.Composite([
  occurrenceWithUnitSchema,
  t.Object({ classes: t.Array(classWithSlotsSchema) }),
])

// Occurrences are the concrete (course unit, course, academic year) tuples —
// the place where a course unit is actually taught. These routes expose two
// read-only views of that data:
//
//   GET /v1/occurrences/:id — single occurrence with course unit info
//
// Both are behind a session (`?`): anonymous callers get a 401 before the
// handler runs. `semester` is validated as `t.Integer({ minimum: 1, maximum: 2 })`
// so the incoming URL string is coerced to a number and range-checked before
// the handler runs — values outside {1, 2} are rejected with a 422.

// Elysia does not propagate a parent instance's `decorate` types into a
// standalone plugin, so the dependency is declared on the instance's own type.
// `use()` still merges the parent's decoration at runtime.
// This tells TypeScript: "this plugin expects `occurrenceRepository` to be
// available on the Elysia context."
type OccurrenceDependencies = {
  decorator: {
    repositories: {
      classRepository: ClassRepository
      occurrenceRepository: OccurrenceRepository,
      exchangePeriodsRepository: ExchangePeriodsRepository
    }
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
    // Returns a single occurrence enriched with its course unit's name and
    // acronym. `year` is required because the occurrence id alone is not
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
        const occurrences = await repositories.occurrenceRepository.findById(params.id, query.year)
        if (!occurrences) throw new HttpError('occurrence-not-found', `Occurrence ${params.id} not found`, 404)

        return repositories.exchangePeriodsRepository.findByOccurrence(params.id, query.year)
      },
      {
        response: { 200: t.Array(exchangePeriodSchema), 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        query: t.Object({ year: t.Integer() }),
        detail: { tags : ['occurrences'], summary: 'List exchange periods'},
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
