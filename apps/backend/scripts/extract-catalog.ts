// Extract a small, FEUP-scoped slice of the scraper's catalog into a committed
// fixture the seeder can read without depending on the raw SQLite dump.
//
// Source of truth: `database.db` at the repo root (the scraper's SQLite output,
// legacy Django catalog shape). Only the catalog lives there — no users,
// classes, schedules, or exchanges.
//
// Scope: FEUP's three software-engineering courses, matching the app's target:
//   - L.EIC  (22841) Licenciatura em Engenharia Informática e Computação
//   - M.EIC  (22862) Mestrado  em Engenharia Informática e Computação
//   - MESW   (10861) Mestrado  em Engenharia de Software
//
// The output is already shaped for `contract.prisma`: each legacy `course_unit`
// row (which carries the Sigarra `pv_ocorrencia_id`) becomes an `Occurrence`,
// and gets its own `CourseUnit`.
//
// Deliberately NOT merged: `course_unit` only exposes the *occurrence* id, not
// Sigarra's stable course-unit id, so two units that share an acronym/name (e.g.
// IPC offered to both L.EIC and MESW) may be the same subject or two distinct
// ones — the dump cannot tell. We stay honest and never guess, so a shared
// subject appears as one `CourseUnit` per course. Keying `CourseUnit` on
// Sigarra's UC id (once the scraper emits it) would collapse the genuinely
// shared ones exactly.
//
// Run: bun scripts/extract-catalog.ts

import { Database } from 'bun:sqlite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DB_PATH = resolve(HERE, '../../../database.db')
const OUT_PATH = resolve(HERE, '../src/scripts/fixtures/feup-leic-meic-mesw.json')

const FACULTY = 'feup'
const COURSE_IDS = [22841, 22862, 10861] as const

type FacultyRow = { acronym: string; name: string | null }
type CourseRow = {
  id: number
  acronym: string
  name: string
  course_type: string
  year: number
  url: string
}
type UnitRow = {
  id: number
  course_id: number
  acronym: string
  name: string
  semester: number
  year: number
  url: string
  hash: string | null
  ects: string | number | null
}

/**
 * `ects` has mixed SQLite storage: whole credits are REAL (`6`), the halves are
 * TEXT with a comma decimal (`"4,5"`). Normalize both to a number.
 */
function parseEcts(raw: string | number | null): number {
  if (raw == null) {
    throw new Error('Occurrence without ects — the scraper always writes one.')
  }
  return typeof raw === 'number' ? raw : Number(raw.replace(',', '.'))
}

/** The scraper leaves stray whitespace/newlines in some text columns. */
function clean(value: string): string {
  return value.trim()
}

const sqlite = new Database(DB_PATH, { readonly: true })

const faculty = sqlite.query<FacultyRow, [string]>('SELECT acronym, name FROM faculty WHERE acronym = ?').get(FACULTY)
if (!faculty) throw new Error(`Faculty ${FACULTY} not found in ${DB_PATH}`)

const placeholders = COURSE_IDS.map(() => '?').join(', ')
const courses = sqlite
  .query<CourseRow, number[]>(
    `SELECT id, acronym, name, course_type, year, url
       FROM course
      WHERE id IN (${placeholders})
      ORDER BY id`,
  )
  .all(...COURSE_IDS)

const units = sqlite
  .query<UnitRow, number[]>(
    `SELECT cu.id,
            cu.course_id,
            cu.acronym,
            cu.name,
            cu.semester,
            cu.year,
            cu.url,
            cu.hash,
            (SELECT m.ects
               FROM course_metadata m
              WHERE m.course_id = cu.course_id
                AND m.course_unit_id = cu.id
              LIMIT 1) AS ects
       FROM course_unit cu
      WHERE cu.course_id IN (${placeholders})
      ORDER BY cu.course_id, cu.id`,
  )
  .all(...COURSE_IDS)

sqlite.close()

// One CourseUnit per occurrence — no cross-course merging (see the header).
// The occurrence id is a stable, unique key for the pair.
const courseUnits: Array<{
  key: string
  courseId: number
  acronym: string
  name: string
  semester: number
}> = []

const occurrences = units.map((u) => {
  const key = `unit-${u.id}`
  courseUnits.push({
    key,
    courseId: u.course_id,
    acronym: clean(u.acronym),
    name: clean(u.name),
    semester: u.semester,
  })
  return {
    id: u.id,
    courseUnitKey: key,
    courseId: u.course_id,
    year: u.year,
    ects: parseEcts(u.ects),
    url: u.url,
    hash: u.hash ?? '',
  }
})

const fixture = {
  source: 'database.db',
  faculty: {
    acronym: faculty.acronym,
    name: clean(faculty.name ?? faculty.acronym),
  },
  courses: courses.map((c) => ({
    id: c.id,
    acronym: c.acronym,
    name: clean(c.name),
    courseType: c.course_type,
    year: c.year,
    url: c.url,
  })),
  courseUnits,
  occurrences,
}

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, `${JSON.stringify(fixture, null, 2)}\n`)

console.log(
  `Wrote ${OUT_PATH}\n` +
    `  faculty: ${fixture.faculty.acronym}\n` +
    `  courses: ${fixture.courses.length}\n` +
    `  courseUnits: ${fixture.courseUnits.length}\n` +
    `  occurrences: ${fixture.occurrences.length}`,
)
