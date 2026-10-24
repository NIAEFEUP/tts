import { t } from 'elysia'

// Wire schemas shared by the catalog route groups (`/v1/faculties`,
// `/v1/courses`, `/v1/course-units`, and `/v1/occurrences`). Keeping shapes
// here — rather than inline per route — means every surface describes the same
// resource identically and cannot drift.
//
// Error bodies (`{ error, code }`) use the shared `apiError` schema from
// `@/interface/middleware/error-handler`; each route instance registers it as
// the named model `ApiError`.

/** A course as the catalog exposes it. `faculties` is an array because a course
 * can be offered by multiple faculties (shared courses). */
export const courseSchema = t.Object({
  id: t.Number(),
  acronym: t.String(),
  name: t.String(),
  courseType: t.String(),
  year: t.Number(),
  url: t.String(),
  faculties: t.Array(t.String()),
})

/** An abstract, year-agnostic course unit ("BD" — Bases de Dados). It owns no
 * classes, periods, or enrollments — those belong to an `occurrence`. */
export const courseUnitSchema = t.Object({
  id: t.Number(),
  courseId: t.Number(),
  acronym: t.String(),
  name: t.String(),
  semester: t.Union([t.Literal(1), t.Literal(2)]),
})

/** A concrete occurrence of a course unit: the (unit, course, year) tuple
 * where the unit is actually taught. `id` is unique per academic year. */
export const occurrenceSchema = t.Object({
  id: t.Number(),
  courseUnitId: t.Number(),
  courseId: t.Number(),
  year: t.Number(),
  ects: t.Number(),
  url: t.String(),
  hash: t.String(),
})

/** An occurrence joined with its course unit's human-readable fields. Used by
 * `GET /v1/occurrences/:id`, which must return the unit's name and acronym
 * alongside the occurrence data without forcing the client to make a second
 * request to `/v1/course-units/:id`. */
export const occurrenceWithUnitSchema = t.Object({
  id: t.Number(),
  courseUnitId: t.Number(),
  courseId: t.Number(),
  year: t.Number(),
  ects: t.Number(),
  url: t.String(),
  hash: t.String(),
  acronym: t.String(),
  name: t.String(),
})
