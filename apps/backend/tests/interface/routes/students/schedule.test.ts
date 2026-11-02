import { describe, expect, it } from 'bun:test'

import { UNAUTHORIZED_BODY } from '../support/catalog-test-utils'
import {
  CLASSMATE,
  FORBIDDEN_BODY,
  STRANGER,
  STUDENT_ADMIN,
  VIEWER,
  createFakeEnrollments,
  createStudentsApp,
  enrollmentIn,
  studentNotFoundBody,
} from '../support/student-test-utils'

// VIEWER and CLASSMATE share occurrence (100, 2025). STRANGER is in occurrence
// 100 too, but in 2024: same Sigarra id, different academic year.
const buildApp = (viewer = VIEWER) => {
  const { repository, sharesOccurrenceCalls } = createFakeEnrollments({
    [VIEWER.id]: [enrollmentIn(100, 2025, 1)],
    [CLASSMATE.id]: [enrollmentIn(100, 2025, 2), enrollmentIn(200, 2025, 3)],
    [STRANGER.id]: [enrollmentIn(100, 2024, 4), enrollmentIn(300, 2025, 5)],
  })

  return { ...createStudentsApp({ viewer, enrollments: repository }), sharesOccurrenceCalls }
}

const classIds = (body: unknown) => (body as Array<{ classId: number }>).map((entry) => entry.classId)

describe('student schedule route', () => {
  it("returns the target's schedule to a student who shares an occurrence", async () => {
    const { get } = buildApp()
    const { status, contentType, body } = await get(`/v1/students/${CLASSMATE.id}/schedule`)

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    // the target's classes, not the viewer's
    expect(classIds(body)).toEqual([2, 3])
  })

  it('resolves the up-prefixed form to the same student', async () => {
    const { get } = buildApp()
    const { status, body } = await get(`/v1/students/up${CLASSMATE.id}/schedule`)

    expect(status).toBe(200)
    expect(classIds(body)).toEqual([2, 3])
  })

  it('forbids a student who shares no occurrence', async () => {
    const { get } = buildApp()
    const { status, body } = await get(`/v1/students/${STRANGER.id}/schedule`)

    expect(status).toBe(403)
    expect(body).toEqual(FORBIDDEN_BODY)
  })

  it('lets an admin read any schedule without the participant check', async () => {
    const { get, sharesOccurrenceCalls } = buildApp(STUDENT_ADMIN)
    const { status, body } = await get(`/v1/students/${STRANGER.id}/schedule`)

    expect(status).toBe(200)
    expect(classIds(body)).toEqual([4, 5])
    expect(sharesOccurrenceCalls).toEqual([])
  })

  it('lets a student read their own schedule without the participant check', async () => {
    const { get, sharesOccurrenceCalls } = buildApp()
    const { status, body } = await get(`/v1/students/${VIEWER.id}/schedule`)

    expect(status).toBe(200)
    expect(classIds(body)).toEqual([1])
    expect(sharesOccurrenceCalls).toEqual([])
  })

  it('lets a student with no enrollments read their own schedule', async () => {
    const { get } = createStudentsApp({ viewer: VIEWER, enrollments: createFakeEnrollments({}).repository })
    const { status, body } = await get(`/v1/students/${VIEWER.id}/schedule`)

    expect(status).toBe(200)
    expect(body).toEqual([])
  })

  it('asks the participant check about the viewer and the target', async () => {
    const { get, sharesOccurrenceCalls } = buildApp()
    await get(`/v1/students/${CLASSMATE.id}/schedule`)

    expect(sharesOccurrenceCalls).toEqual([[VIEWER.id, CLASSMATE.id]])
  })

  it('answers 404 before 403 for an unknown student', async () => {
    const { get } = buildApp()
    const { status, body } = await get('/v1/students/202099999/schedule')

    expect(status).toBe(404)
    expect(body).toEqual(studentNotFoundBody('202099999'))
  })

  it('rejects an anonymous caller with a 401', async () => {
    const { get } = buildApp()
    const { status, body } = await get(`/v1/students/${CLASSMATE.id}/schedule`, { cookie: null })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })

  it('rejects an unrecognised session cookie with a 401', async () => {
    const { get } = buildApp()
    const { status, body } = await get(`/v1/students/${CLASSMATE.id}/schedule`, { cookie: 'session=forged' })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })
})
