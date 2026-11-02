import { Elysia, t } from 'elysia'

import { isAdmin } from '@/core/auth/user'
import { normalizeNmec } from '@/core/auth/nmec'
import { createGetStudentSchedule } from '@/application/use-cases/students/get-student-schedule'
import { studentPhotoUrl } from '@/application/use-cases/students/student-photo-url'
import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { StudentCourseMetadataRepository } from '@/domain/ports/student-course-metadata.repository'
import type { UserRepository } from '@/domain/ports/user.repository'
import { HttpError, httpError } from '@/interface/errors/errors'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { scheduleEntrySchema } from '../users/schemas'
import { studentCourseMetadataSchema, studentProfileSchema } from './students.schemas'

// Student lookup. Every route first resolves `:nmec` to a student (404 when
// there is none), then checks what the caller may see (403), so the check order
// is always 401 → 404 → 403. `up202012345` and `202012345` name the same student.

type StudentRoutesContext = {
  decorator: {
    repositories: {
      userRepository: UserRepository
      enrollmentRepository: EnrollmentRepository
      studentCourseMetadataRepository: StudentCourseMetadataRepository
    }
  }
  store: {}
  derive: {}
  resolve: {}
}

export type StudentRoutesDeps = {
  sessions: SessionRepository
}

export const studentRoutes = ({ sessions }: StudentRoutesDeps) =>
  new Elysia<'/v1/students', StudentRoutesContext>({ prefix: '/v1/students' })
    .model({ ApiError: apiError })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .derive({ as: 'scoped' }, ({ repositories }) => ({
      findStudent: async (nmec: string) => {
        const student = await repositories.userRepository.findById(normalizeNmec(nmec))
        if (!student) throw new HttpError('student-not-found', `Student ${nmec} not found`, 404)

        return student
      },
    }))
    // GET /v1/students/202012345 — public profile (name only), any signed-in user.
    .get(
      '/:nmec',
      async ({ params, findStudent }) => {
        const student = await findStudent(params.nmec)
        return { name: student.name }
      },
      {
        params: t.Object({ nmec: t.String() }),
        response: { 200: studentProfileSchema, 401: 'ApiError', 404: 'ApiError' },
        detail: { tags: ['students'], summary: 'Get a student profile' },
      },
    )
    // GET /v1/students/202012345/photo — redirects to the Sigarra photo.
    .get(
      '/:nmec/photo',
      async ({ params, findStudent, redirect }) => {
        const student = await findStudent(params.nmec)
        return redirect(studentPhotoUrl(student.id), 302)
      },
      {
        params: t.Object({ nmec: t.String() }),
        response: { 302: t.Void(), 401: 'ApiError', 404: 'ApiError' },
        detail: { tags: ['students'], summary: 'Get a student photo' },
      },
    )
    // GET /v1/students/202012345/schedule — admins, the student, and students
    // who share an occurrence with them.
    .get(
      '/:nmec/schedule',
      async ({ params, user, findStudent, repositories }) => {
        if (!user) throw httpError.unauthorized()
        const student = await findStudent(params.nmec)

        const getStudentSchedule = createGetStudentSchedule({ enrollments: repositories.enrollmentRepository })
        const schedule = await getStudentSchedule(user, student.id)
        if (!schedule) throw httpError.forbidden()

        return schedule
      },
      {
        params: t.Object({ nmec: t.String() }),
        response: { 200: t.Array(scheduleEntrySchema), 401: 'ApiError', 403: 'ApiError', 404: 'ApiError' },
        detail: { tags: ['students'], summary: "Get a student's class schedule" },
      },
    )
    // GET /v1/students/202012345/courses/22841/metadata — admins only.
    .get(
      '/:nmec/courses/:courseId/metadata',
      async ({ params, user, findStudent, repositories }) => {
        if (!user) throw httpError.unauthorized()
        const student = await findStudent(params.nmec)
        if (!isAdmin(user)) throw httpError.forbidden()

        const metadata = await repositories.studentCourseMetadataRepository.find(student.id, params.courseId)
        if (!metadata) {
          throw new HttpError(
            'student-course-metadata-not-found',
            `No metadata for student ${student.id} in course ${params.courseId}`,
            404,
          )
        }

        return metadata
      },
      {
        params: t.Object({ nmec: t.String(), courseId: t.Integer() }),
        response: { 200: studentCourseMetadataSchema, 401: 'ApiError', 403: 'ApiError', 404: 'ApiError' },
        detail: { tags: ['students'], summary: "Get a student's course metadata" },
      },
    )
