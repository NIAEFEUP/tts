// Shared seeding core. Two thin entry scripts call `runSeed`:
//   - `src/scripts/seed.ts`       → catalog only (`bun run db:seed`)
//   - `src/scripts/seed-demo.ts`  → catalog + mock exchange data (`bun run db:seed:demo`)
//
// Both run `reset()` first, which truncates every table. The two are therefore
// mutually exclusive: `db:seed` empties the demo tables (ExchangeItem,
// ExchangeRequest, User, …) and `db:seed:demo` re-creates them.
//
// Prisma 8 has no `prisma db seed`; per the package-owned prisma-8 skill the
// supported pattern is a standalone script that imports the `db` client.
//
// The catalog is real scraper data (see the fixture). The demo layer is
// hand-authored mock data — users, classes, enrollments, exchange windows,
// sample exchanges and enrollment requests — so the flows have data to show.
// It covers L.EIC and M.EIC only: MESW is in the catalog but not part of the
// exchange feature.

import 'temporal-polyfill/global' // Prisma 8 DateTime fields are Temporal.Instant

import { Temporal } from 'temporal-polyfill'
import { normalizeNmec } from '@/core/auth/nmec'
import { db } from '@/infrastructure/database/prisma'
import fixture from './fixtures/feup-leic-meic-mesw.json' with { type: 'json' }

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Occurrence = (typeof fixture.occurrences)[number]
type Participant = { nmec: string; classId: number }

type ExchangeType = 'DIRECT' | 'MARKETPLACE' | 'URGENT'
type ExchangeStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED'
type AdminValidationState = 'UNTREATED' | 'TREATED' | 'REJECTED' | 'AWAITING_INFORMATION'

// --- Safety guard -----------------------------------------------------------

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]'])

function assertLocalDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is not set.')

  const { hostname } = new URL(databaseUrl)
  if (!LOOPBACK_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to seed ${hostname}: this script deletes every row and only runs ` +
        `against a loopback DATABASE_URL (got host "${hostname}").`,
    )
  }
}

// --- Demo roster ------------------------------------------------------------

// The demo admin is whoever sets `ADMIN_UP` (an NMEC / "up" number) in their
// environment; falls back to a generic `admin` account. Its role comes from
// `ADMIN_ROLE` (USER | ADMIN | SUPERUSER, default ADMIN). See `.env.schema`.
const ADMIN_ID = normalizeNmec(process.env.ADMIN_UP?.trim() || 'admin')

const USER_ROLES = ['USER', 'ADMIN', 'SUPERUSER'] as const
type UserRole = (typeof USER_ROLES)[number]

const ADMIN_ROLE = (process.env.ADMIN_ROLE?.trim().toUpperCase() || 'ADMIN') as UserRole
if (!USER_ROLES.includes(ADMIN_ROLE)) {
  throw new Error(`ADMIN_ROLE must be one of ${USER_ROLES.join(', ')} (got "${process.env.ADMIN_ROLE}").`)
}

// NMECs end in `999`: the frontend maps any username ending in 999 to a mock
// avatar (see apps/frontend/src/api/services/studentInfo.ts).
const STUDENTS: Array<{ nmec: string; name: string; courseId: number }> = [
  // L.EIC (22841)
  { nmec: '202300999', name: 'Alice Ferreira', courseId: 22841 },
  { nmec: '202301999', name: 'Bruno Matos', courseId: 22841 },
  { nmec: '202302999', name: 'Carla Nunes', courseId: 22841 },
  { nmec: '202303999', name: 'Diogo Alves', courseId: 22841 },
  { nmec: '202304999', name: 'Eduarda Rocha', courseId: 22841 },
  { nmec: '202305999', name: 'Filipe Sousa', courseId: 22841 },
  // M.EIC (22862)
  { nmec: '202306999', name: 'Gabriela Lima', courseId: 22862 },
  { nmec: '202307999', name: 'Henrique Pinto', courseId: 22862 },
  { nmec: '202308999', name: 'Inês Carvalho', courseId: 22862 },
]

// The exchange feature covers L.EIC and M.EIC only. MESW stays in the catalog
// but is not part of exchanges, so the demo layer never touches its occurrences.
const DEMO_COURSE_IDS = new Set([22841, 22862])

const EXCHANGE_OPENS = Temporal.Instant.from('2026-09-01T00:00:00Z')
const EXCHANGE_CLOSES = Temporal.Instant.from('2026-12-20T23:59:59Z')

/** How many of a course's occurrences each student is enrolled in. */
const ENROLLMENTS_PER_STUDENT = 4

// --- Reset ------------------------------------------------------------------

async function reset(tx: Tx): Promise<void> {
  // One TRUNCATE clears every table in the contract and, with RESTART IDENTITY,
  // resets the autoincrement sequences so a re-seed always yields the same ids
  // (CourseUnit / Class starting at 1) instead of ever-growing ones. CASCADE
  // covers the FK graph without ordering.
  const truncate = db.raw.sql`
    TRUNCATE TABLE
      "AdminCourse", "AdminOccurrence", "Class", "Course", "CourseUnit",
      "Enrollment", "EnrollmentRequest", "EnrollmentRequestOption",
      "ExchangeItem", "ExchangePeriod", "ExchangeRequest", "Faculty",
      "FacultyCourse", "Occurrence", "PlannerState", "Professor",
      "ScheduleSlot", "Session", "SlotClass", "SlotProfessor",
      "StudentCourseMetadata", "User"
    RESTART IDENTITY CASCADE
  `
    .affectedCount()
    .build()
  await tx.execute(truncate)
}

// --- Catalog ----------------------------------------------------------------

async function seedCatalog(tx: Tx): Promise<void> {
  await tx.orm.public.Faculty.create({
    acronym: fixture.faculty.acronym,
    name: fixture.faculty.name,
  })

  await tx.orm.public.Course.createAll(
    fixture.courses.map((c) => ({
      id: c.id,
      acronym: c.acronym,
      name: c.name,
      courseType: c.courseType,
      year: c.year,
      url: c.url,
    })),
  )

  await tx.orm.public.FacultyCourse.createAll(
    fixture.courses.map((c) => ({
      facultyId: fixture.faculty.acronym,
      courseId: c.id,
    })),
  )

  // CourseUnit ids are autoincrement, so create them one by one and remember
  // the generated id for each fixture key.
  const unitIdByKey = new Map<string, number>()
  for (const unit of fixture.courseUnits) {
    const row = await tx.orm.public.CourseUnit.select('id').create({
      courseId: unit.courseId,
      acronym: unit.acronym,
      name: unit.name,
      semester: unit.semester,
      courseUnitYear: unit.courseUnitYear,
    })
    unitIdByKey.set(unit.key, row.id)
  }

  await tx.orm.public.Occurrence.createAll(
    fixture.occurrences.map((o) => {
      const courseUnitId = unitIdByKey.get(o.courseUnitKey)
      if (courseUnitId === undefined) {
        throw new Error(`No CourseUnit for key "${o.courseUnitKey}"`)
      }
      return {
        id: o.id,
        courseUnitId,
        courseId: o.courseId,
        year: o.year,
        ects: o.ects,
        url: o.url,
        hash: o.hash,
      }
    }),
  )
}

// --- Demo exchange data -----------------------------------------------------

type DemoSummary = {
  users: number
  classes: number
  enrollments: number
  exchangePeriods: number
  exchangeRequests: number
  exchangeItems: number
  enrollmentRequests: number
  enrollmentRequestOptions: number
  adminCourses: number
  adminOccurrences: number
}

type ExchangeItemInsert = {
  requestId: string
  userId: string
  occurrenceId: number
  occurrenceYear: number
  fromClassId: number
  toClassId: number
  accepted?: boolean
}

async function seedDemo(tx: Tx): Promise<DemoSummary> {
  // 1. Users: one admin plus the student roster.
  if (STUDENTS.some((s) => s.nmec === ADMIN_ID)) {
    throw new Error(`ADMIN_UP ("${ADMIN_ID}") collides with a seeded student NMEC.`)
  }
  await tx.orm.public.User.createAll([
    { id: ADMIN_ID, email: `${ADMIN_ID}@fe.up.pt`, name: 'Admin TTS', role: ADMIN_ROLE },
    ...STUDENTS.map((s) => ({
      id: s.nmec,
      email: `up${s.nmec}@fe.up.pt`,
      name: s.name,
    })),
  ])

  // 2. Which course each student belongs to.
  await tx.orm.public.StudentCourseMetadata.createAll(
    STUDENTS.map((s, i) => ({ nmec: s.nmec, courseId: s.courseId, festId: 900001 + i })),
  )

  // 3. Two classes per occurrence, so every unit is selectable. `L.EIC` → `LEIC`.
  //    Demo courses only: MESW is not part of the exchange.
  const demoOccurrences = fixture.occurrences.filter((o) => DEMO_COURSE_IDS.has(o.courseId))
  const shortName = (courseId: number) => fixture.courses.find((c) => c.id === courseId)!.acronym.replace(/\./g, '')

  const classRows = demoOccurrences.flatMap((o) => {
    const short = shortName(o.courseId)
    return ['01', '02'].map((n) => ({
      occurrenceId: o.id,
      occurrenceYear: o.year,
      name: `1${short}${n}`,
      vacancies: 30,
    }))
  })
  const createdClasses = await tx.orm.public.Class.createAll(classRows)

  // Group the returned classes by occurrence. Keyed by (occurrence, name) rather
  // than by index, since INSERT ... RETURNING ordering is not contractual.
  const classIdByKey = new Map<string, number>()
  for (const c of createdClasses) {
    classIdByKey.set(`${c.occurrenceId}|${c.name}`, c.id)
  }
  const classIdsByOcc = new Map<number, { a: number; b: number }>()
  for (const o of demoOccurrences) {
    const short = shortName(o.courseId)
    const a = classIdByKey.get(`${o.id}|1${short}01`)
    const b = classIdByKey.get(`${o.id}|1${short}02`)
    if (a === undefined || b === undefined) {
      throw new Error(`Missing classes for occurrence ${o.id}`)
    }
    classIdsByOcc.set(o.id, { a, b })
  }

  // 4. Enroll each student in the first few occurrences of their own course,
  //    alternating classes so pairs of students end up in opposing classes.
  const occurrencesByCourse = new Map<number, Occurrence[]>()
  for (const o of [...fixture.occurrences].sort((x, y) => x.id - y.id)) {
    const list = occurrencesByCourse.get(o.courseId) ?? []
    list.push(o)
    occurrencesByCourse.set(o.courseId, list)
  }

  const enrollRows: Array<{ userId: string; classId: number }> = []
  const enrollmentsByStudent = new Map<string, Array<{ occurrenceId: number; classId: number }>>()
  const nextStudentIndex = new Map<number, number>()

  for (const s of STUDENTS) {
    const idx = nextStudentIndex.get(s.courseId) ?? 0
    nextStudentIndex.set(s.courseId, idx + 1)

    const occurrences = (occurrencesByCourse.get(s.courseId) ?? []).slice(0, ENROLLMENTS_PER_STUDENT)
    const mine: Array<{ occurrenceId: number; classId: number }> = []
    occurrences.forEach((o, j) => {
      const ids = classIdsByOcc.get(o.id)!
      const classId = (idx + j) % 2 === 0 ? ids.a : ids.b
      enrollRows.push({ userId: s.nmec, classId })
      mine.push({ occurrenceId: o.id, classId })
    })
    enrollmentsByStudent.set(s.nmec, mine)
  }
  await tx.orm.public.Enrollment.createAll(enrollRows)

  // Participants per occurrence, sorted by NMEC for determinism.
  const participantsByOcc = new Map<number, Participant[]>()
  for (const [nmec, list] of enrollmentsByStudent) {
    for (const e of list) {
      const arr = participantsByOcc.get(e.occurrenceId) ?? []
      arr.push({ nmec, classId: e.classId })
      participantsByOcc.set(e.occurrenceId, arr)
    }
  }
  for (const arr of participantsByOcc.values()) arr.sort((x, y) => x.nmec.localeCompare(y.nmec))

  const pick = (occurrenceId: number, index: number): Participant => {
    const p = participantsByOcc.get(occurrenceId)?.[index]
    if (!p) throw new Error(`No participant #${index} at occurrence ${occurrenceId}`)
    return p
  }
  const otherClass = (occurrenceId: number, classId: number) => {
    const ids = classIdsByOcc.get(occurrenceId)!
    return classId === ids.a ? ids.b : ids.a
  }

  const lEic = occurrencesByCourse.get(22841)!
  const mEic = occurrencesByCourse.get(22862)!

  // 5. Open every demo-course occurrence for exchange over the same window.
  await tx.orm.public.ExchangePeriod.createAll(
    demoOccurrences.map((o) => ({
      occurrenceId: o.id,
      occurrenceYear: o.year,
      startsAt: EXCHANGE_OPENS,
      endsAt: EXCHANGE_CLOSES,
    })),
  )

  // 6. Sample exchanges: three of each type, each created by a different student.
  const exchangeItemRows: ExchangeItemInsert[] = []

  const direct = async (
    o: Occurrence,
    creatorIdx: number,
    targetIdx: number,
    status: ExchangeStatus,
    opts: { adminState?: AdminValidationState; accepted?: boolean } = {},
  ) => {
    const creator = pick(o.id, creatorIdx)
    const target = pick(o.id, targetIdx)
    const req = await tx.orm.public.ExchangeRequest.create({
      creatorId: creator.nmec,
      targetUserId: target.nmec,
      type: 'DIRECT',
      status,
      adminState: opts.adminState,
    })
    const accepted = opts.accepted ?? false
    exchangeItemRows.push(
      {
        requestId: req.id,
        userId: creator.nmec,
        occurrenceId: o.id,
        occurrenceYear: o.year,
        fromClassId: creator.classId,
        toClassId: target.classId,
        accepted,
      },
      {
        requestId: req.id,
        userId: target.nmec,
        occurrenceId: o.id,
        occurrenceYear: o.year,
        fromClassId: target.classId,
        toClassId: creator.classId,
        accepted,
      },
    )
  }

  const single = async (
    type: Exclude<ExchangeType, 'DIRECT'>,
    o: Occurrence,
    creatorIdx: number,
    opts: { status?: ExchangeStatus; adminState?: AdminValidationState; message?: string } = {},
  ) => {
    const creator = pick(o.id, creatorIdx)
    const req = await tx.orm.public.ExchangeRequest.create({
      creatorId: creator.nmec,
      type,
      status: opts.status ?? 'PENDING',
      adminState: opts.adminState,
      message: opts.message,
    })
    exchangeItemRows.push({
      requestId: req.id,
      userId: creator.nmec,
      occurrenceId: o.id,
      occurrenceYear: o.year,
      fromClassId: creator.classId,
      toClassId: otherClass(o.id, creator.classId),
    })
  }

  // DIRECT ×3
  await direct(lEic[0], 0, 1, 'PENDING')
  await direct(lEic[1], 2, 3, 'ACCEPTED', { adminState: 'TREATED', accepted: true })
  await direct(mEic[0], 0, 1, 'CANCELLED')

  // MARKETPLACE ×3
  await single('MARKETPLACE', lEic[2], 3)
  await single('MARKETPLACE', mEic[1], 1, { status: 'ACCEPTED', adminState: 'TREATED' })
  await single('MARKETPLACE', mEic[2], 2, { status: 'CANCELLED', adminState: 'REJECTED' })

  // URGENT ×3
  await single('URGENT', lEic[0], 4, {
    adminState: 'AWAITING_INFORMATION',
    message: 'Incompatibilidade de horário com outra unidade curricular.',
  })
  await single('URGENT', lEic[1], 5, {
    adminState: 'TREATED',
    message: 'Sobreposição de avaliação no mesmo dia.',
  })
  await single('URGENT', lEic[2], 1, {
    status: 'CANCELLED',
    adminState: 'REJECTED',
    message: 'Pedido desnecessário após reorganização do horário.',
  })

  await tx.orm.public.ExchangeItem.createAll(exchangeItemRows)

  // 7. Enrollment requests: add/drop course units, across statuses.
  const enrollmentRequestOptionRows: Array<{
    requestId: string
    occurrenceId: number
    occurrenceYear: number
    enrolling: boolean
  }> = []

  const enrollmentRequest = async (
    nmec: string,
    occurrences: Occurrence[],
    enrolling: boolean[],
    status: ExchangeStatus,
    adminState: AdminValidationState,
  ) => {
    const req = await tx.orm.public.EnrollmentRequest.create({ userId: nmec, status, adminState })
    occurrences.forEach((o, i) => {
      enrollmentRequestOptionRows.push({
        requestId: req.id,
        occurrenceId: o.id,
        occurrenceYear: o.year,
        enrolling: enrolling[i] ?? true,
      })
    })
  }

  await enrollmentRequest('202300999', [lEic[4], lEic[5]], [true, true], 'PENDING', 'UNTREATED')
  await enrollmentRequest('202307999', [mEic[2]], [true], 'ACCEPTED', 'TREATED')
  await enrollmentRequest('202308999', [mEic[3]], [false], 'CANCELLED', 'REJECTED')
  await enrollmentRequest('202304999', [lEic[6], lEic[7]], [true, false], 'PENDING', 'AWAITING_INFORMATION')

  await tx.orm.public.EnrollmentRequestOption.createAll(enrollmentRequestOptionRows)

  // 8. Admin scope. An ADMIN/SUPERUSER is admin for everything — every course
  //    and every occurrence. A plain USER gets no admin scope at all.
  let adminCourses = 0
  let adminOccurrences = 0
  if (ADMIN_ROLE !== 'USER') {
    await tx.orm.public.AdminCourse.createAll(fixture.courses.map((c) => ({ userId: ADMIN_ID, courseId: c.id })))
    await tx.orm.public.AdminOccurrence.createAll(
      fixture.occurrences.map((o) => ({
        userId: ADMIN_ID,
        occurrenceId: o.id,
        occurrenceYear: o.year,
      })),
    )
    adminCourses = fixture.courses.length
    adminOccurrences = fixture.occurrences.length
  }

  return {
    users: 1 + STUDENTS.length,
    classes: classRows.length,
    enrollments: enrollRows.length,
    exchangePeriods: demoOccurrences.length,
    exchangeRequests: 9,
    exchangeItems: exchangeItemRows.length,
    enrollmentRequests: 4,
    enrollmentRequestOptions: enrollmentRequestOptionRows.length,
    adminCourses,
    adminOccurrences,
  }
}

// --- Entry ------------------------------------------------------------------

export type SeedSummary = {
  catalog: { courses: number; courseUnits: number; occurrences: number }
  demo?: DemoSummary
}

export async function runSeed(options: { demo: boolean }): Promise<SeedSummary> {
  assertLocalDatabase()

  const summary = await db.transaction(async (tx) => {
    await reset(tx)
    await seedCatalog(tx)

    return {
      catalog: {
        courses: fixture.courses.length,
        courseUnits: fixture.courseUnits.length,
        occurrences: fixture.occurrences.length,
      },
      demo: options.demo ? await seedDemo(tx) : undefined,
    }
  })

  await db.close()
  return summary
}
