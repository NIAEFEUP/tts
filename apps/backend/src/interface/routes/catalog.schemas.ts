import { t } from 'elysia'

// Wire schemas shared by the catalog route groups (`/v1/faculties`,
// `/v1/courses`, and `/v1/course-units`). Keeping the course shape here —
// rather than inline per route — means every surface describes a course
// identically and cannot drift.
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
