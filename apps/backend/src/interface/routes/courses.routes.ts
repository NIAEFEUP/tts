// Elysia is the web framework; `t` is its schema validator (like Zod).
import { Elysia, status, t } from 'elysia'

// HttpError is a custom error class; the global error handler catches it and
// returns clean JSON responses with the right status code.
import { HttpError, httpError } from '@/interface/errors/errors'

// The port (interface) defines *what* methods exist — not *how* they work.
// Imported as `type` only: the route never touches the database directly.
import type { CourseRepository } from '@/domain/ports/course.repository'
import type { CourseUnitRepository } from '@/domain/ports/course-unit.repository'
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { ExchangePeriodsRepository, ExchangePeriod } from '@/domain/ports/exchange-period.repository'
import type { AdminRepository } from '@/domain/ports/admin.repository'
import { isAdmin } from '@/core/auth/user'
import { createCreateExchangeCoursePeriods } from '@/application/use-cases/exchange/create-exchange-period'
import type { CoursePeriodFailure } from '@/application/use-cases/exchange/exchange-period-common'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import {
  courseSchema,
  courseUnitSchema,
  createExchangePeriodSchema,
  exchangePeriodSchema,
  occurrenceWithUnitSchema,
} from './catalog.schemas'

// Routes read `repositories` off the Elysia context — no infrastructure imports.
// A missing course throws `HttpError('course-not-found')`; the global `onError`
// hook formats the response. Query params use Elysia's `t` schema so invalid
// input is rejected with 422 before reaching the handler.

// Elysia does not propagate a parent instance's `decorate` types into a
// standalone plugin, so the dependency is declared on the instance's own type.
// `use()` still merges the parent's decoration at runtime.
// This tells TypeScript: "this plugin expects `repositories.courseRepository`
// to be available on the Elysia context."
function presentPeriod(period: ExchangePeriod) {
  return {
    id: period.id,
    occurrenceId: period.occurrenceId,
    occurrenceYear: period.occurrenceYear,
    startsAt: period.startsAt.toISOString(),
    endsAt: period.endsAt.toISOString(),
  }
}

function authorisationError(failure: CoursePeriodFailure, courseId: number): HttpError {
  switch (failure.kind) {
    case 'forbidden':
      return httpError.forbidden()
    case 'invalid-period-range':
      return new HttpError('invalid-period-range', 'startsAt must be before endsAt', 400)
    case 'course-not-found':
      return new HttpError('course-not-found', `Course ${courseId} not found`, 404)
  }
}

type CourseDependencies = {
  decorator: {
    repositories: {
      courseRepository: CourseRepository
      courseUnitRepository: CourseUnitRepository
      occurrenceRepository: OccurrenceRepository
      exchangePeriodsRepository: ExchangePeriodsRepository
      adminRepository: AdminRepository
    }
  }
  store: {}
  derive: {}
  resolve: {}
}

// All routes defined on this instance will be prefixed with `/v1/courses`.
// The `/api` segment seen in public URLs is added by the deployment (Niployments
// mounts the service under `/api`), so it must not appear here.
//
// The catalog is behind a session: `createRequiredAuthMiddleware` derives `user`
// and rejects anonymous callers with a 401 before any handler runs. The frontend
// only reads the catalog after login, and the docs mark these routes with `?`.
export type CourseRoutesDeps = {
  sessions: SessionRepository
}

export const courseRoutes = ({ sessions }: CourseRoutesDeps) =>
  new Elysia<'/v1/courses', CourseDependencies>({
    prefix: '/v1/courses',
  })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    // `404: 'ApiError'` below references a named model. Elysia resolves model
    // names per-instance, so it must be registered here too — the app-level
    // registration in `openapiPlugin` is only visible when `use()`d as a parent
    // (and it is skipped entirely in production).
    .model({ ApiError: apiError })
    // GET /v1/courses?year=2025&faculty=FEUP
    // Lists courses, ordered by acronym. Both filters are optional and combine:
    // an unknown faculty simply matches nothing (empty list, not a 404).
    .get(
      '/',
      ({ repositories, query }) => repositories.courseRepository.findAll({ year: query.year, faculty: query.faculty }),
      {
        response: { 200: t.Array(courseSchema) },
        query: t.Object({ year: t.Optional(t.Integer()), faculty: t.Optional(t.String()) }),
        detail: { tags: ['courses'], summary: 'List courses' },
      },
    )
    // GET /v1/courses/22841
    // Returns a single course. The `:id` path param is validated as an integer
    // (non-numeric ids get a 422); a well-formed but unknown id throws
    // HttpError → 404 JSON response.
    .get(
      '/:id',
      async ({ repositories, params }) => {
        const found = await repositories.courseRepository.findById(params.id)
        if (!found) throw new HttpError('course-not-found', `Course ${params.id} not found`, 404)

        return found
      },
      {
        response: { 200: courseSchema, 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        detail: { tags: ['courses'], summary: 'Get one course' },
      },
    )
    // GET /v1/courses/22841/units
    // Lists the abstract course units the course offers, ordered by acronym.
    // The course must exist first: an unknown id throws HttpError → 404. A
    // course that exists but offers no units answers an empty list, not a 404.
    .get(
      '/:id/units',
      async ({ repositories, params }) => {
        const course = await repositories.courseRepository.findById(params.id)
        if (!course) throw new HttpError('course-not-found', `Course ${params.id} not found`, 404)

        return repositories.courseUnitRepository.findByCourse(params.id)
      },
      {
        response: { 200: t.Array(courseUnitSchema), 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        detail: { tags: ['courses'], summary: 'Course units of a course' },
      },
    )
    // GET /v1/courses/22841/occurrences?year=2025&semester=1
    // Lists occurrences for a course, enriched with the course unit's acronym,
    // name, and curricular year, optionally filtered by academic year and
    // semester. The course must exist first; a course with no matches returns
    // an empty list.
    .get(
      '/:id/occurrences',
      async ({ repositories, params, query }) => {
        const course = await repositories.courseRepository.findById(params.id)
        if (!course) throw new HttpError('course-not-found', `Course ${params.id} not found`, 404)

        return repositories.occurrenceRepository.findByCourse(params.id, {
          year: query.year,
          semester: query.semester as 1 | 2 | undefined,
        })
      },
      {
        response: { 200: t.Array(occurrenceWithUnitSchema), 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        query: t.Object({
          year: t.Optional(t.Integer()),
          semester: t.Optional(t.Integer({ minimum: 1, maximum: 2 })),
        }),
        detail: { tags: ['courses'], summary: 'Occurrences of a course' },
      },
    )
    // GET /v1/courses/22841/periods
    // Exchange periods of every occurrence of the course, ordered by `startsAt`.
    // An unknown course is a 404; a course without periods returns `[]`.
    .get(
      '/:id/periods',
      async ({ repositories, params }) => {
        const course = await repositories.courseRepository.findById(params.id)
        if (!course) throw new HttpError('course-not-found', `Course ${params.id} not found`, 404)
        const periods = await repositories.exchangePeriodsRepository.findByCourse(params.id)
        return periods.map((period) => ({
          id: period.id,
          startsAt: period.startsAt.toISOString(),
          endsAt: period.endsAt.toISOString(),
        }))
      },
      {
        response: { 200: t.Array(t.Pick(exchangePeriodSchema, ['id', 'startsAt', 'endsAt'])), 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        detail: { tags: ['courses'], summary: 'List exchange periods of a course' },
      },
    )
    .post(
      '/:id/periods',
      async ({ repositories, user, params, body }) => {
        if (!user) throw httpError.unauthorized()
        if (!isAdmin(user)) throw httpError.forbidden()

        const createExchangeCoursePeriods = createCreateExchangeCoursePeriods({
          admins: repositories.adminRepository,
          courses: repositories.courseRepository,
          periods: repositories.exchangePeriodsRepository,
        })
        const result = await createExchangeCoursePeriods({
          user,
          courseId: params.id,
          startsAt: new Date(body.startsAt),
          endsAt: new Date(body.endsAt),
        })

        switch (result.kind) {
          case 'forbidden':
          case 'invalid-period-range':
          case 'course-not-found':
            throw authorisationError(result, params.id)
          case 'overlap':
            throw new HttpError(
              'exchange-period-overlap',
              `Exchange period overlaps another period for occurrence ${result.occurrenceId} in ${result.occurrenceYear}`,
              409,
            )
          case 'created':
            break
        }

        return status(201, result.periods.map(presentPeriod))
      },
      {
        params: t.Object({ id: t.Integer() }),
        body: createExchangePeriodSchema,
        response: {
          201: t.Array(exchangePeriodSchema),
          400: 'ApiError',
          401: 'ApiError',
          403: 'ApiError',
          404: 'ApiError',
          409: 'ApiError',
        },
        detail: { tags: ['courses'], summary: 'Open exchange periods for every occurrence of a course' },
      },
    )
