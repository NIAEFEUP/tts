import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { AuthUser } from '@/core/auth/user'
import type { ScheduleRepository, ScheduledClass } from '@/domain/ports/schedule.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { StudentCourseMetadata, StudentRepository } from '@/domain/ports/student.repository'
import { createApp } from '@/main'

// Drives the real app via `createApp().handle(request)` with fake repositories,
// so the tests assert HTTP behaviour — status codes, error bodies, and who may
// see what — without a database. Each session token maps to one fake user.

const user = (id: string, name: string, role: AuthUser['role'] = 'USER'): AuthUser => ({
  id,
  name,
  email: `${id}@up.pt`,
  role,
})

const ANA = user('202012345', 'Ana Silva') // plain user, shares LEIC with Bruno
const BRUNO = user('202099999', 'Bruno Costa') // the student being looked up
const CARLA = user('202011111', 'Carla Dias') // plain user, different course
const ADMIN = user('202000001', 'Admin Root', 'ADMIN')
const SUPERUSER = user('202000002', 'Super Root', 'SUPERUSER')

const USERS = [ANA, BRUNO, CARLA, ADMIN, SUPERUSER]

const tokens: Record<string, AuthUser> = {
  ana: ANA,
  bruno: BRUNO,
  carla: CARLA,
  admin: ADMIN,
  superuser: SUPERUSER,
}

const LEIC = 22841
const MAP = 22990

const coursesByStudent: Record<string, number[]> = {
  [ANA.id]: [LEIC],
  [BRUNO.id]: [LEIC],
  [CARLA.id]: [MAP],
}

const brunoSchedule: ScheduledClass[] = [
  {
    classId: 10,
    className: '1LEIC01',
    occurrenceId: 501,
    occurrenceYear: 2025,
    courseUnit: { acronym: 'BD', name: 'Bases de Dados' },
    slots: [
      { id: 1, lessonType: 'T', dayOfWeek: 2, startMinute: 540, durationMin: 120, location: 'B001' },
      { id: 2, lessonType: 'TP', dayOfWeek: 4, startMinute: 600, durationMin: 120, location: null },
    ],
  },
]

const metadata: StudentCourseMetadata[] = [{ nmec: BRUNO.id, courseId: LEIC, festId: 777 }]

const sessions: SessionRepository = {
  issue: async () => 'unused',
  resolve: async (token) => tokens[token] ?? null,
  revoke: async () => {},
}

const students: StudentRepository = {
  async findProfile(nmec) {
    const found = USERS.find((candidate) => candidate.id === nmec)
    return found ? { nmec: found.id, name: found.name } : null
  },
  async findCourseMetadata(nmec, courseId) {
    return metadata.find((row) => row.nmec === nmec && row.courseId === courseId) ?? null
  },
}

const schedules: ScheduleRepository = {
  async findByStudent(nmec) {
    return nmec === BRUNO.id ? brunoSchedule : []
  },
  async sharesCourse(nmecA, nmecB) {
    const coursesA = coursesByStudent[nmecA] ?? []
    return (coursesByStudent[nmecB] ?? []).some((courseId) => coursesA.includes(courseId))
  },
}

const app = createApp({
  repositories: { sessionRepository: sessions, studentRepository: students, scheduleRepository: schedules },
  studentPhotos: { urlFor: (nmec) => `https://photos.test/${nmec}.jpg` },
})

const get = async (path: string, as: string | null = 'ana') => {
  const response = await app.handle(
    new Request(`http://localhost${path}`, { headers: as ? { cookie: `session=${as}` } : undefined }),
  )

  return { status: response.status, body: (await response.json()) as unknown }
}

const UNAUTHORIZED = { error: 'Authentication required', code: 'unauthorized' }
const FORBIDDEN = { error: 'You are not allowed to access this student', code: 'forbidden' }
const unknownStudent = (nmec: string) => ({ error: `Student ${nmec} not found`, code: 'student-not-found' })

test('every student route rejects an anonymous caller with 401', async () => {
  for (const path of [
    `/v1/students/${BRUNO.id}`,
    `/v1/students/${BRUNO.id}/photo`,
    `/v1/students/${BRUNO.id}/schedule`,
    `/v1/students/${BRUNO.id}/courses/${LEIC}/metadata`,
  ]) {
    const { status, body } = await get(path, null)

    assert.equal(status, 401, path)
    assert.deepEqual(body, UNAUTHORIZED, path)
  }
})

test('any signed-in user gets a public profile with the name only', async () => {
  const { status, body } = await get(`/v1/students/${BRUNO.id}`, 'carla')

  assert.equal(status, 200)
  assert.deepEqual(body, { nmec: BRUNO.id, name: 'Bruno Costa' })
})

test('the profile accepts the `up`-prefixed NMEC Sigarra displays', async () => {
  const { status, body } = await get(`/v1/students/up${BRUNO.id}`)

  assert.equal(status, 200)
  assert.deepEqual(body, { nmec: BRUNO.id, name: 'Bruno Costa' })
})

test('an unknown student answers 404 student-not-found', async () => {
  for (const path of ['/v1/students/000', '/v1/students/000/photo', '/v1/students/000/schedule']) {
    const { status, body } = await get(path, 'admin')

    assert.equal(status, 404, path)
    assert.deepEqual(body, unknownStudent('000'), path)
  }
})

test('any signed-in user gets the photo URL', async () => {
  const { status, body } = await get(`/v1/students/${BRUNO.id}/photo`, 'carla')

  assert.equal(status, 200)
  assert.deepEqual(body, { url: `https://photos.test/${BRUNO.id}.jpg` })
})

test('a student reads their own schedule', async () => {
  const { status, body } = await get(`/v1/students/${BRUNO.id}/schedule`, 'bruno')

  assert.equal(status, 200)
  assert.deepEqual(body, { nmec: BRUNO.id, classes: brunoSchedule })
})

test('a student of the same course reads the schedule', async () => {
  const { status, body } = await get(`/v1/students/${BRUNO.id}/schedule`, 'ana')

  assert.equal(status, 200)
  assert.deepEqual(body, { nmec: BRUNO.id, classes: brunoSchedule })
})

test('admins and superusers read any schedule', async () => {
  for (const as of ['admin', 'superuser']) {
    const { status, body } = await get(`/v1/students/${BRUNO.id}/schedule`, as)

    assert.equal(status, 200, as)
    assert.deepEqual(body, { nmec: BRUNO.id, classes: brunoSchedule }, as)
  }
})

test('a student of another course gets 403 on the schedule', async () => {
  const { status, body } = await get(`/v1/students/${BRUNO.id}/schedule`, 'carla')

  assert.equal(status, 403)
  assert.deepEqual(body, FORBIDDEN)
})

test('an enrolled student with an empty schedule answers an empty list, not an error', async () => {
  const { status, body } = await get(`/v1/students/${ANA.id}/schedule`, 'ana')

  assert.equal(status, 200)
  assert.deepEqual(body, { nmec: ANA.id, classes: [] })
})

test('admins read the course metadata', async () => {
  const { status, body } = await get(`/v1/students/${BRUNO.id}/courses/${LEIC}/metadata`, 'admin')

  assert.equal(status, 200)
  assert.deepEqual(body, { nmec: BRUNO.id, courseId: LEIC, festId: 777 })
})

test('a plain user gets 403 on the metadata, even for their own', async () => {
  for (const as of ['ana', 'bruno']) {
    const { status, body } = await get(`/v1/students/${BRUNO.id}/courses/${LEIC}/metadata`, as)

    assert.equal(status, 403, as)
    assert.deepEqual(body, FORBIDDEN, as)
  }
})

test('a plain user cannot tell an unknown student from a known one on the metadata', async () => {
  const { status, body } = await get(`/v1/students/000/courses/${LEIC}/metadata`, 'ana')

  assert.equal(status, 403)
  assert.deepEqual(body, FORBIDDEN)
})

test('the metadata of an unknown student is 404 student-not-found for an admin', async () => {
  const { status, body } = await get(`/v1/students/000/courses/${LEIC}/metadata`, 'admin')

  assert.equal(status, 404)
  assert.deepEqual(body, unknownStudent('000'))
})

test('a course with no stored metadata is 404 student-course-metadata-not-found', async () => {
  const { status, body } = await get(`/v1/students/${BRUNO.id}/courses/${MAP}/metadata`, 'admin')

  assert.equal(status, 404)
  assert.deepEqual(body, {
    error: `No metadata for student ${BRUNO.id} in course ${MAP}`,
    code: 'student-course-metadata-not-found',
  })
})

test('a non-numeric courseId is rejected by the param schema', async () => {
  const { status, body } = await get(`/v1/students/${BRUNO.id}/courses/leic/metadata`, 'admin')

  assert.equal(status, 422)
  assert.deepEqual(body, { error: 'Request failed validation', code: 'validation-error' })
})
