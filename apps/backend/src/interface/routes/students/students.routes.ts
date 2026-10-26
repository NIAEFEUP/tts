import { Elysia } from 'elysia'

import { normalizeNmec } from '@/core/auth/nmec'
import { createGetStudentCourseMetadata } from '@/application/use-cases/students/get-student-course-metadata'
import { createGetStudentPhoto } from '@/application/use-cases/students/get-student-photo'
import { createGetStudentProfile } from '@/application/use-cases/students/get-student-profile'
import { createGetStudentSchedule } from '@/application/use-cases/students/get-student-schedule'
import type { ScheduleRepository } from '@/domain/ports/schedule.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { StudentPhotoProvider } from '@/domain/ports/student-photo.provider'
import type { StudentRepository } from '@/domain/ports/student.repository'
import { HttpError, httpError } from '@/interface/errors/errors'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import {
  studentCourseMetadata,
  studentCourseParams,
  studentParams,
  studentPhoto,
  studentProfile,
  studentSchedule,
} from './students.schemas'

export type StudentRoutesDeps = {
  sessions: SessionRepository
  students: StudentRepository
  schedules: ScheduleRepository
  photos: StudentPhotoProvider
}

// Each use case answers with a `reason`; this is the only place those become
// HTTP errors, so the routes below stay a one-liner per outcome.
type Failure = 'student-not-found' | 'metadata-not-found' | 'forbidden'

function failure(reason: Failure, nmec: string, courseId?: number): HttpError {
  switch (reason) {
    case 'student-not-found':
      return new HttpError('student-not-found', `Student ${nmec} not found`, 404)
    case 'metadata-not-found':
      return new HttpError(
        'student-course-metadata-not-found',
        `No metadata for student ${nmec} in course ${courseId}`,
        404,
      )
    case 'forbidden':
      return httpError.forbidden('You are not allowed to access this student')
  }
}

/**
 * Student lookup, mounted under `/v1/students`. Every route needs a session;
 * the profile and photo are open to any signed-in user, the schedule to its
 * owner, admins and students of the same course, and the course metadata to
 * admins only.
 */
export const studentRoutes = ({ sessions, students, schedules, photos }: StudentRoutesDeps) => {
  const getProfile = createGetStudentProfile({ students })
  const getPhoto = createGetStudentPhoto({ students, photos })
  const getSchedule = createGetStudentSchedule({ students, schedules })
  const getCourseMetadata = createGetStudentCourseMetadata({ students })

  return (
    new Elysia({ prefix: '/v1/students' })
      .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
      // Model names resolve per instance, so `ApiError` must be registered here too.
      .model({ ApiError: apiError })
      // GET /v1/students/202012345
      .get(
        '/:nmec',
        async ({ params }) => {
          const nmec = normalizeNmec(params.nmec)
          const result = await getProfile(nmec)
          if (!result.ok) throw failure(result.reason, nmec)

          return result.profile
        },
        {
          params: studentParams,
          response: { 200: studentProfile, 401: 'ApiError', 404: 'ApiError' },
          detail: { tags: ['students'], summary: 'Get a student profile' },
        },
      )
      // GET /v1/students/202012345/photo
      .get(
        '/:nmec/photo',
        async ({ params }) => {
          const nmec = normalizeNmec(params.nmec)
          const result = await getPhoto(nmec)
          if (!result.ok) throw failure(result.reason, nmec)

          return { url: result.url }
        },
        {
          params: studentParams,
          response: { 200: studentPhoto, 401: 'ApiError', 404: 'ApiError' },
          detail: { tags: ['students'], summary: 'Get a student photo URL' },
        },
      )
      // GET /v1/students/202012345/schedule
      .get(
        '/:nmec/schedule',
        async ({ params, user }) => {
          if (!user) throw httpError.unauthorized()

          const nmec = normalizeNmec(params.nmec)
          const result = await getSchedule(user, nmec)
          if (!result.ok) throw failure(result.reason, nmec)

          return { nmec, classes: result.classes }
        },
        {
          params: studentParams,
          response: { 200: studentSchedule, 401: 'ApiError', 403: 'ApiError', 404: 'ApiError' },
          detail: { tags: ['students'], summary: 'Get a student schedule' },
        },
      )
      // GET /v1/students/202012345/courses/22841/metadata
      .get(
        '/:nmec/courses/:courseId/metadata',
        async ({ params, user }) => {
          if (!user) throw httpError.unauthorized()

          const nmec = normalizeNmec(params.nmec)
          const result = await getCourseMetadata(user, nmec, params.courseId)
          if (!result.ok) throw failure(result.reason, nmec, params.courseId)

          return result.metadata
        },
        {
          params: studentCourseParams,
          response: { 200: studentCourseMetadata, 401: 'ApiError', 403: 'ApiError', 404: 'ApiError' },
          detail: { tags: ['students'], summary: 'Get a student course metadata' },
        },
      )
  )
}
