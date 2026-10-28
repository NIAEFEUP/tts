// Elysia is the web framework; `t` is its schema validator (like Zod).
import { Elysia, t } from 'elysia'

// HttpError is a custom error class; the global error handler catches it and
// returns clean JSON responses with the right status code.
import { HttpError } from '@/interface/errors/errors'

// The port (interface) defines *what* methods exist — not *how* they work.
// Imported as `type` only: the route never touches the database directly.
import type { FacultyRepository } from '@/domain/ports/faculty.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { courseSchema } from './catalog.schemas'

// Schema for a faculty response. Elysia uses these to validate responses,
// generate OpenAPI docs, and strip unexpected fields before sending.
// `name` can be null because some faculties may not have a name in the database.
const faculty = t.Object({
  acronym: t.String(),
  name: t.Union([t.String(), t.Null()]),
})

// Routes read `repositories` off the Elysia context — no infrastructure imports.
// A missing faculty throws `HttpError('faculty-not-found')`; the global `onError`
// hook formats the response. Query params use Elysia's `t` schema so invalid
// input is rejected with 422 before reaching the handler.

// Elysia does not propagate a parent instance's `decorate` types into a
// standalone plugin, so the dependency is declared on the instance's own type.
// `use()` still merges the parent's decoration at runtime.
// This tells TypeScript: "this plugin expects `repositories.facultyRepository`
// to be available on the Elysia context."
type FacultyDependencies = {
  decorator: { repositories: { facultyRepository: FacultyRepository } }
  store: {}
  derive: {}
  resolve: {}
}

// All routes defined on this instance will be prefixed with `/v1/faculties`.
// The `/api` segment seen in public URLs is added by the deployment (Niployments
// mounts the service under `/api`), so it must not appear here.
//
// The catalog is behind a session: `createRequiredAuthMiddleware` derives `user`
// and rejects anonymous callers with a 401 before any handler runs. The frontend
// only reads the catalog after login, and the docs mark these routes with `?`.
export type FacultyRoutesDeps = {
  sessions: SessionRepository
}

export const facultyRoutes = ({ sessions }: FacultyRoutesDeps) =>
  new Elysia<'/v1/faculties', FacultyDependencies>({
    prefix: '/v1/faculties',
  })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    // `404: 'ApiError'` below references a named model. Elysia resolves model
    // names per-instance, so it must be registered here too — the app-level
    // registration in `openapiPlugin` is only visible when `use()`d as a parent
    // (and it is skipped entirely in production).
    .model({ ApiError: apiError })
    // GET /v1/faculties/
    // Lists all faculties, ordered by acronym. Requires a signed-in user.
    .get('/', ({ repositories }) => repositories.facultyRepository.findAll(), {
      response: { 200: t.Array(faculty) },
      detail: { tags: ['faculties'], summary: 'List faculties' },
    })
    // GET /v1/faculties/FEUP
    // Returns a single faculty by acronym. The `:acronym` path param is captured
    // as `params.acronym`. If not found, throws HttpError → 404 JSON response.
    .get(
      '/:acronym',
      async ({ repositories, params }) => {
        const faculty = await repositories.facultyRepository.findByAcronym(params.acronym)
        if (!faculty) throw new HttpError('faculty-not-found', `Faculty ${params.acronym} not found`, 404)

        return faculty
      },
      {
        response: { 200: faculty, 404: 'ApiError' },
        detail: { tags: ['faculties'], summary: 'Get one faculty' },
      },
    )
    // GET /v1/faculties/FEUP/courses?year=2024
    // Returns courses offered by a faculty. The `year` query param is optional;
    // Elysia validates it as an integer — invalid input gets a 422 automatically.
    // First checks the faculty exists (404 if not), then fetches its courses.
    .get(
      '/:acronym/courses',
      async ({ repositories, params, query }) => {
        const faculty = await repositories.facultyRepository.findByAcronym(params.acronym)
        if (!faculty) throw new HttpError('faculty-not-found', `Faculty ${params.acronym} not found`, 404)

        const year = query.year

        return repositories.facultyRepository.findCoursesByFaculty(params.acronym, year)
      },
      {
        response: { 200: t.Array(courseSchema), 404: 'ApiError' },
        detail: { tags: ['faculties'], summary: 'Courses offered by a faculty' },
        query: t.Object({ year: t.Optional(t.Integer()) }),
      },
    )
