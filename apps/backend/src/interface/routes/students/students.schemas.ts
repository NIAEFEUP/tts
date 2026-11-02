import { t } from 'elysia'

export const studentProfileSchema = t.Object({ name: t.String() })

export const studentCourseMetadataSchema = t.Object({
  courseId: t.Number(),
  festId: t.Number(),
})
