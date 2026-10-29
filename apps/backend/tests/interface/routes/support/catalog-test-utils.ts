import { expect, it } from 'bun:test'

import type { Course, CourseRepository } from '@/domain/ports/course.repository'
import type { CourseUnit, CourseUnitRepository } from '@/domain/ports/course-unit.repository'
import type { Faculty, FacultyRepository } from '@/domain/ports/faculty.repository'
import type { Occurrence, OccurrenceWithUnit, OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { createApp } from '@/main'
import type { App } from '@/main'
import { TEST_SESSION_TOKEN, createFakeSessions } from './auth-test-utils'

// Shared infrastructure for the catalog route tests (`courses`, `faculties`,
// and `course-units`).
//
// Drives the real app via `createApp().handle(request)` — no listener or
// database. The repository fakes owned by this module stand in for the
// database, so tests assert real HTTP behaviour: status codes, error bodies,
// and query validation. Auth fakes (user, session, cookies) come from
// `auth-test-utils`: `TEST_SESSION_TOKEN` is the only session the app
// recognises, and every request presents it unless told otherwise.
//
// Adding a catalog route group means adding its fixtures + fake repository here
// and defaulting it in `createCatalogApp`, so its test file stays assertions-only.

export const COURSES: Course[] = [
  {
    id: 22841,
    acronym: 'L.EIC',
    name: 'Licenciatura em Engenharia Informática e Computação',
    courseType: 'L',
    year: 2025,
    url: 'https://sigarra.up.pt/feup/pt/cur_geral.cur_view?pv_curso_id=22841',
    faculties: ['FEUP'],
  },
  {
    id: 22990,
    acronym: 'MAP',
    name: 'Mestrado em Avaliação e Políticas Públicas',
    courseType: 'M',
    year: 2025,
    url: 'https://sigarra.up.pt/fcup/pt/cur_geral.cur_view?pv_curso_id=22990',
    // A course shared by two faculties carries both.
    faculties: ['FCUP', 'FEUP'],
  },
  {
    id: 22201,
    acronym: 'L.EIC',
    name: 'Licenciatura em Engenharia Informática e Computação',
    courseType: 'L',
    year: 2024,
    url: 'https://sigarra.up.pt/feup/pt/cur_geral.cur_view?pv_curso_id=22201',
    faculties: ['FEUP'],
  },
]

export const FACULTIES: Faculty[] = [
  { acronym: 'FCUP', name: 'Faculdade de Ciências' },
  { acronym: 'FEUP', name: 'Faculdade de Engenharia' },
]

/**
 * Abstract course units. A unit belongs to a course; the same subject taught
 * in another course or year is a *different* unit row with its own id, and
 * only `OCCURRENCES` link a unit to the courses/years it is taught in.
 *
 * Course 22201 deliberately offers no units, and unit 44 has no occurrence.
 */
export const COURSE_UNITS: CourseUnit[] = [
  { id: 42, courseId: 22841, acronym: 'BD', name: 'Bases de Dados', semester: 1 },
  { id: 43, courseId: 22841, acronym: 'COMP', name: 'Computação', semester: 2 },
  { id: 44, courseId: 22990, acronym: 'BD', name: 'Bases de Dados', semester: 1 },
]

/** Concrete occurrences: unit 42 is taught in two courses across two years. */
export const OCCURRENCES: Occurrence[] = [
  {
    id: 587177,
    courseUnitId: 42,
    courseId: 22841,
    year: 2025,
    ects: 6,
    url: 'https://sigarra.up.pt/feup/pt/ucurr_geral.ficha_uc_view?pv_ocorrencia_id=587177',
    hash: 'hash-bd-2025',
  },
  {
    id: 587178,
    courseUnitId: 42,
    courseId: 22990,
    year: 2024,
    ects: 4,
    url: 'https://sigarra.up.pt/fcup/pt/ucurr_geral.ficha_uc_view?pv_ocorrencia_id=587178',
    hash: 'hash-bd-2024',
  },
  {
    id: 587179,
    courseUnitId: 43,
    courseId: 22841,
    year: 2025,
    ects: 6,
    url: 'https://sigarra.up.pt/feup/pt/ucurr_geral.ficha_uc_view?pv_ocorrencia_id=587179',
    hash: 'hash-comp-2025',
  },
]

/** Error bodies shared by every catalog route, so tests assert shapes, not literals. */
export const UNAUTHORIZED_BODY = { error: 'Authentication required', code: 'unauthorized' }
export const VALIDATION_ERROR_BODY = { error: 'Request failed validation', code: 'validation-error' }

/** The catalog data both repository fakes are built from. */
export type CatalogFixtures = {
  courses?: Course[]
  faculties?: Faculty[]
  courseUnits?: CourseUnit[]
  occurrences?: Occurrence[]
}

/** In-memory `CourseRepository` over `courses` (defaults to `COURSES`). */
export function createFakeCourseRepository({ courses = COURSES }: CatalogFixtures = {}): CourseRepository {
  return {
    async findAll(filter = {}) {
      return courses.filter(
        (course) =>
          (filter.year === undefined || course.year === filter.year) &&
          (filter.faculty === undefined || course.faculties.includes(filter.faculty)),
      )
    },

    async findById(id) {
      return courses.find((course) => course.id === id) ?? null
    },
  }
}

/** In-memory `FacultyRepository` over `faculties`, backed by `courses` for the join. */
export function createFakeFacultyRepository({
  faculties = FACULTIES,
  courses = COURSES,
}: CatalogFixtures = {}): FacultyRepository {
  return {
    async findAll() {
      return faculties
    },

    async findByAcronym(acronym) {
      return faculties.find((faculty) => faculty.acronym === acronym) ?? null
    },

    async findCoursesByFaculty(acronym, year) {
      return courses.filter(
        (course) => course.faculties.includes(acronym) && (year === undefined || course.year === year),
      )
    },
  }
}

/** In-memory `CourseUnitRepository` over `courseUnits` (defaults to `COURSE_UNITS`). */
export function createFakeCourseUnitRepository({
  courseUnits = COURSE_UNITS,
}: CatalogFixtures = {}): CourseUnitRepository {
  return {
    async findById(id) {
      return courseUnits.find((unit) => unit.id === id) ?? null
    },

    async findByCourse(courseId) {
      // `filter` returns a fresh array, so sorting never mutates the fixture.
      return courseUnits.filter((unit) => unit.courseId === courseId).sort((a, b) => a.acronym.localeCompare(b.acronym))
    },
  }
}

/** In-memory `OccurrenceRepository` over `occurrences` (defaults to `OCCURRENCES`). */
export function createFakeOccurrenceRepository({
  occurrences = OCCURRENCES,
  courseUnits = COURSE_UNITS,
}: CatalogFixtures = {}): OccurrenceRepository {
  return {
    async findByCourseUnit(courseUnitId) {
      // Newest year first, then by id — the order the Prisma repository uses.
      return occurrences
        .filter((occurrence) => occurrence.courseUnitId === courseUnitId)
        .sort((a, b) => b.year - a.year || a.id - b.id)
    },

    async findByCourse(courseId, filter = {}) {
      // `filter` returns a fresh array, so sorting never mutates the fixture.
      // Semester lives on `CourseUnit`, so filtering by it requires a lookup
      // — the same join the Prisma implementation does via a relation traversal.
      return occurrences
        .filter((occurrence) => {
          if (occurrence.courseId !== courseId) return false
          if (filter.year !== undefined && occurrence.year !== filter.year) return false
          if (filter.semester !== undefined) {
            const unit = courseUnits.find((u) => u.id === occurrence.courseUnitId && u.courseId === courseId)
            if (!unit || unit.semester !== filter.semester) return false
          }
          return true
        })
        .sort((a, b) => b.year - a.year || a.id - b.id)
    },

    async findById(id, year): Promise<OccurrenceWithUnit | null> {
      // Match on the composite primary key (id, year) — id alone is not unique
      // because Sigarra reuses occurrence ids across academic years.
      const occurrence = occurrences.find((o) => o.id === id && o.year === year)
      if (!occurrence) return null

      // Join the course unit to attach its name and acronym, mirroring the
      // enriched shape the Prisma implementation returns.
      const unit = courseUnits.find((u) => u.id === occurrence.courseUnitId)
      if (!unit) return null

      return { ...occurrence, acronym: unit.acronym, name: unit.name }
    },
  }
}

export type CatalogRepositories = CatalogFixtures & {
  courseRepository?: CourseRepository
  courseUnitRepository?: CourseUnitRepository
  facultyRepository?: FacultyRepository
  occurrenceRepository?: OccurrenceRepository
  sessionRepository?: SessionRepository
}

export type CatalogResponse = {
  status: number
  contentType: string
  body: unknown
}

export type GetOptions = { authenticated?: boolean }

/** GET `request` against `app`, authenticated as `USER` unless told otherwise. */
export async function getCatalog(app: App, request: string, options: GetOptions = {}): Promise<CatalogResponse> {
  const response = await app.handle(
    new Request(`http://localhost${request}`, {
      headers: options.authenticated === false ? undefined : { cookie: `session=${TEST_SESSION_TOKEN}` },
    }),
  )

  return {
    status: response.status,
    contentType: response.headers.get('content-type') ?? '',
    body: (await response.json()) as unknown,
  }
}

/**
 * Builds the app with the in-memory catalog and an always-signed-in session.
 * `courses`/`faculties`/`courseUnits`/`occurrences` feed the repository fakes,
 * so a custom course list and its faculty join stay consistent; any repository
 * can be overridden outright when a test needs different behaviour, or omitted
 * to use the fakes above.
 *
 * Returns the app (for raw `app.handle` calls) and a `get` bound to it.
 */
export function createCatalogApp({
  courses,
  faculties,
  courseUnits,
  occurrences,
  courseRepository,
  courseUnitRepository,
  facultyRepository,
  occurrenceRepository,
  sessionRepository,
}: CatalogRepositories = {}) {
  const fixtures: CatalogFixtures = { courses, faculties, courseUnits, occurrences }

  const app = createApp({
    repositories: {
      courseRepository: courseRepository ?? createFakeCourseRepository(fixtures),
      courseUnitRepository: courseUnitRepository ?? createFakeCourseUnitRepository(fixtures),
      facultyRepository: facultyRepository ?? createFakeFacultyRepository(fixtures),
      occurrenceRepository: occurrenceRepository ?? createFakeOccurrenceRepository(fixtures),
      sessionRepository: sessionRepository ?? createFakeSessions(),
    },
  })

  return {
    app,
    get: (request: string, options: GetOptions = {}) => getCatalog(app, request, options),
  }
}

/**
 * Registers the auth-guard tests every catalog route group needs. For each
 * `requests` path, an anonymous and a forged-session request must answer 401.
 * Call once inside the file's `describe`, right after `createCatalogApp`; the
 * titles name the path so a failure points straight at the broken route.
 */
export function registerCatalogAuthGuard(app: App, requests: string[]) {
  for (const request of requests) {
    it(`${request} rejects an anonymous caller with a 401 unauthorized`, async () => {
      const { status, body } = await getCatalog(app, request, { authenticated: false })

      expect(status).toBe(401)
      expect(body).toEqual(UNAUTHORIZED_BODY)
    })

    it(`${request} rejects an unrecognised session cookie with a 401`, async () => {
      const response = await app.handle(
        new Request(`http://localhost${request}`, { headers: { cookie: 'session=forged' } }),
      )

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual(UNAUTHORIZED_BODY)
    })
  }
}
