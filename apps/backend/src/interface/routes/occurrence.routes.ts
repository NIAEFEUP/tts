// Elysia is the web framework; `t` is its schema validator (like Zod).
import { Elysia, t } from 'elysia'

// HttpError is a custom error class; the global error handler catches it and
// returns clean JSON responses with the right status code.
import { HttpError } from '@/interface/errors/errors'

// The ports define *what* methods exist — not *how* they work.
// Imported as `type` only: the route never touches the database directly.
import type { CourseRepository } from '@/domain/ports/course.repository'
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { occurrenceSchema, occurrenceWithUnitSchema } from './catalog.schemas'

// Occurrences are the concrete (course unit, course, academic year) tuples —
// the place where a course unit is actually taught. These routes expose two
// read-only views of that data:
//
//   GET /v1/courses/:id/occurrences  — list occurrences for a course
//   GET /v1/occurrences/:id          — single occurrence with course unit info
//
// Both are behind a session (`?`): anonymous callers get a 401 before the
// handler runs. `semester` is validated as `t.Integer({ minimum: 1, maximum: 2 })`
// so the incoming URL string is coerced to a number and range-checked before
// the handler runs — values outside {1, 2} are rejected with a 422.

// Elysia does not propagate a parent instance's `decorate` types into a
// standalone plugin, so the dependency is declared on the instance's own type.
// `use()` still merges the parent's decoration at runtime.
// This tells TypeScript: "this plugin expects both `courseRepository` and
// `occurrenceRepository` to be available on the Elysia context."
type OccurrenceDependencies = {
  decorator: {
    repositories: { courseRepository: CourseRepository; occurrenceRepository: OccurrenceRepository }
  }
  store: {}
  derive: {}
  resolve: {}
}

export type OccurrenceRoutesDeps = {
  sessions: SessionRepository
}

export const occurrenceRoutes = ({ sessions }: OccurrenceRoutesDeps) =>
  new Elysia<'/v1', OccurrenceDependencies>({ prefix: '/v1' })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    // `404: 'ApiError'` below references a named model. Elysia resolves model
    // names per-instance, so it must be registered here too — the app-level
    // registration in `openapiPlugin` is only visible when `use()`d as a parent
    // (and it is skipped entirely in production).
    .model({ ApiError: apiError })
    // GET /v1/courses/22841/occurrences?year=2025&semester=1
    // Lists occurrences for a course, optionally filtered by academic year and
    // semester. The course must exist first — an unknown id throws HttpError →
    // 404. A course with no matching occurrences answers an empty list, not a
    // 404. `semester` uses `t.Integer({ minimum: 1, maximum: 2 })` rather than
    // a literal union because query params arrive as strings and Elysia cannot
    // coerce a string to a numeric literal — the integer schema coerces first,
    // then validates the range.
    .get(
      '/courses/:id/occurrences',
      async ({ repositories, params, query }) => {
        const course = await repositories.courseRepository.findById(params.id)
        if (!course) throw new HttpError('course-not-found', `Course ${params.id} not found`, 404)

        return repositories.occurrenceRepository.findByCourse(params.id, {
          year: query.year,
          // Cast is safe: the schema already validated the value is 1 or 2.
          semester: query.semester as 1 | 2 | undefined,
        })
      },
      {
        response: { 200: t.Array(occurrenceSchema), 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        query: t.Object({
          year: t.Optional(t.Integer()),
          semester: t.Optional(t.Integer({ minimum: 1, maximum: 2 })),
        }),
        detail: { tags: ['courses'], summary: 'Occurrences of a course' },
      },
    )
    // GET /v1/occurrences/587177?year=2025
    // Returns a single occurrence enriched with its course unit's name and
    // acronym. `year` is required because the occurrence id alone is not
    // unique — Sigarra reuses the same id across academic years, so the real
    // key is the composite `(id, year)`. An unknown (id, year) pair throws
    // HttpError → 404.
    .get(
      '/occurrences/:id',
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
