import { describe, expect, it } from 'bun:test'

import { UNAUTHORIZED_BODY, VALIDATION_ERROR_BODY } from '../support/catalog-test-utils'
import {
  CLASSMATE,
  FORBIDDEN_BODY,
  STUDENT_ADMIN,
  VIEWER,
  createFakeStudentCourseMetadata,
  createStudentsApp,
  studentNotFoundBody,
} from '../support/student-test-utils'

const metadata = createFakeStudentCourseMetadata([{ nmec: CLASSMATE.id, courseId: 22841, festId: 123456 }])
const path = (nmec: string, courseId: number | string) => `/v1/students/${nmec}/courses/${courseId}/metadata`

describe('student course metadata route', () => {
  const admin = createStudentsApp({ viewer: STUDENT_ADMIN, metadata })

  it('returns the fest id to an admin', async () => {
    const { status, contentType, body } = await admin.get(path(CLASSMATE.id, 22841))

    expect(status).toBe(200)
    expect(contentType).toMatch(/^application\/json/)
    expect(body).toEqual({ courseId: 22841, festId: 123456 })
  })

  it('resolves the up-prefixed form to the same student', async () => {
    const { status, body } = await admin.get(path(`up${CLASSMATE.id}`, 22841))

    expect(status).toBe(200)
    expect(body).toEqual({ courseId: 22841, festId: 123456 })
  })

  it('forbids a non-admin, even for their own metadata', async () => {
    const { get } = createStudentsApp({ viewer: VIEWER, metadata })

    for (const nmec of [CLASSMATE.id, VIEWER.id]) {
      const { status, body } = await get(path(nmec, 22841))

      expect(status).toBe(403)
      expect(body).toEqual(FORBIDDEN_BODY)
    }
  })

  it('answers 404 student-not-found for an unknown student', async () => {
    const { status, body } = await admin.get(path('202099999', 22841))

    expect(status).toBe(404)
    expect(body).toEqual(studentNotFoundBody('202099999'))
  })

  it('answers 404 student-not-found before 403 for a non-admin', async () => {
    const { get } = createStudentsApp({ viewer: VIEWER, metadata })
    const { status, body } = await get(path('202099999', 22841))

    expect(status).toBe(404)
    expect(body).toEqual(studentNotFoundBody('202099999'))
  })

  it('answers 404 student-course-metadata-not-found when there is none for that course', async () => {
    const { status, body } = await admin.get(path(CLASSMATE.id, 99999))

    expect(status).toBe(404)
    expect(body).toEqual({
      error: `No metadata for student ${CLASSMATE.id} in course 99999`,
      code: 'student-course-metadata-not-found',
    })
  })

  it('rejects a non-numeric course id with a 422', async () => {
    const { status, body } = await admin.get(path(CLASSMATE.id, 'abc'))

    expect(status).toBe(422)
    expect(body).toEqual(VALIDATION_ERROR_BODY)
  })

  it('rejects an anonymous caller with a 401', async () => {
    const { status, body } = await admin.get(path(CLASSMATE.id, 22841), { cookie: null })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })

  it('rejects an unrecognised session cookie with a 401', async () => {
    const { status, body } = await admin.get(path(CLASSMATE.id, 22841), { cookie: 'session=forged' })

    expect(status).toBe(401)
    expect(body).toEqual(UNAUTHORIZED_BODY)
  })
})
