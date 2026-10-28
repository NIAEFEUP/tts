// Elysia is the web framework; `t` is its schema validator (like Zod).
import { Elysia, t } from 'elysia'

// HttpError is a custom error class; the global error handler catches it and
// returns clean JSON responses with the right status code.
import { HttpError } from '@/interface/errors/errors'

// The port (interface) defines *what* methods exist — not *how* they work.
// Imported as `type` only: the route never touches the database directly.
import type { CourseUnitRepository } from '@/domain/ports/course-unit.repository'
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { courseUnitSchema, occurrenceSchema } from './catalog.schemas'

// A course unit is the abstract, year-agnostic template ("BD" — Bases de
// Dados). It owns no classes, periods, or enrollments — those belong to an
// occurrence, the (unit, course, year) tuple where the unit is taught.
//
// Routes read `repositories` off the Elysia context — no infrastructure imports.
// A missing unit throws `HttpError('course-unit-not-found')`; the global
// `onError` hook formats the response.

// Elysia does not propagate a parent instance's `decorate` types into a
// standalone plugin, so the dependency is declared on the instance's own type.
// `use()` still merges the parent's decoration at runtime.
// This tells TypeScript: "this plugin expects `repositories.courseUnitRepository`
// to be available on the Elysia context."
type CourseUnitDependencies = {
  decorator: {
    repositories: { courseUnitRepository: CourseUnitRepository; occurrenceRepository: OccurrenceRepository }
  }
  store: {}
  derive: {}
  resolve: {}
}

// All routes defined on this instance will be prefixed with `/v1/course-units`.
// The `/api` segment seen in public URLs is added by the deployment (Niployments
// mounts the service under `/api`), so it must not appear here.
//
// The catalog is behind a session: `createRequiredAuthMiddleware` derives `user`
// and rejects anonymous callers with a 401 before any handler runs. The frontend
// only reads the catalog after login, and the docs mark these routes with `?`.
export type CourseUnitRoutesDeps = {
  sessions: SessionRepository
}

export const courseUnitRoutes = ({ sessions }: CourseUnitRoutesDeps) =>
  new Elysia<'/v1/course-units', CourseUnitDependencies>({
    prefix: '/v1/course-units',
  })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    // `404: 'ApiError'` below references a named model. Elysia resolves model
    // names per-instance, so it must be registered here too — the app-level
    // registration in `openapiPlugin` is only visible when `use()`d as a parent
    // (and it is skipped entirely in production).
    .model({ ApiError: apiError })
    // GET /v1/course-units/42
    // Returns a single abstract course unit. The `:id` path param is validated
    // as an integer (non-numeric ids get a 422); a well-formed but unknown id
    // throws HttpError → 404 JSON response.
    .get(
      '/:id',
      async ({ repositories, params }) => {
        const unit = await repositories.courseUnitRepository.findById(params.id)
        if (!unit) throw new HttpError('course-unit-not-found', `Course unit ${params.id} not found`, 404)

        return unit
      },
      {
        response: { 200: courseUnitSchema, 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        detail: { tags: ['course-units'], summary: 'Get one course unit' },
      },
    )
    // GET /v1/course-units/42/occurrences
    // Lists every concrete occurrence of the unit — across the courses and
    // academic years it is taught in, newest year first. The unit must exist
    // first (404 if not); a unit with no occurrences answers an empty list.
    .get(
      '/:id/occurrences',
      async ({ repositories, params }) => {
        const unit = await repositories.courseUnitRepository.findById(params.id)
        if (!unit) throw new HttpError('course-unit-not-found', `Course unit ${params.id} not found`, 404)

        return repositories.occurrenceRepository.findByCourseUnit(params.id)
      },
      {
        response: { 200: t.Array(occurrenceSchema), 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        detail: { tags: ['course-units'], summary: 'Occurrences of a course unit' },
      },
    )
