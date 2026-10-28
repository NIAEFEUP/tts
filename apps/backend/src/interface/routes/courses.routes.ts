// Elysia is the web framework; `t` is its schema validator (like Zod).
import { Elysia, t } from 'elysia'

// HttpError is a custom error class; the global error handler catches it and
// returns clean JSON responses with the right status code.
import { HttpError } from '@/interface/errors/errors'

// The port (interface) defines *what* methods exist — not *how* they work.
// Imported as `type` only: the route never touches the database directly.
import type { CourseRepository } from '@/domain/ports/course.repository'
import type { CourseUnitRepository } from '@/domain/ports/course-unit.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { courseSchema, courseUnitSchema } from './catalog.schemas'

// Routes read `repositories` off the Elysia context — no infrastructure imports.
// A missing course throws `HttpError('course-not-found')`; the global `onError`
// hook formats the response. Query params use Elysia's `t` schema so invalid
// input is rejected with 422 before reaching the handler.

// Elysia does not propagate a parent instance's `decorate` types into a
// standalone plugin, so the dependency is declared on the instance's own type.
// `use()` still merges the parent's decoration at runtime.
// This tells TypeScript: "this plugin expects `repositories.courseRepository`
// to be available on the Elysia context."
type CourseDependencies = {
  decorator: {
    repositories: { courseRepository: CourseRepository; courseUnitRepository: CourseUnitRepository }
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
