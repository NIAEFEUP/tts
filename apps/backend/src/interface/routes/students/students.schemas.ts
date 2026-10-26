import { t } from 'elysia'

// Response and param schemas for `/v1/students`. Elysia validates responses
// against these, strips unexpected fields and feeds them into the OpenAPI doc.

export const studentParams = t.Object({ nmec: t.String() })

export const studentCourseParams = t.Object({ nmec: t.String(), courseId: t.Integer() })

export const studentProfile = t.Object({
  nmec: t.String(),
  name: t.String(),
})

export const studentPhoto = t.Object({
  url: t.String(),
})

const scheduleSlot = t.Object({
  id: t.Number(),
  lessonType: t.String(),
  dayOfWeek: t.Number(),
  startMinute: t.Number(),
  durationMin: t.Number(),
  location: t.Union([t.String(), t.Null()]),
})

const scheduledClass = t.Object({
  classId: t.Number(),
  className: t.String(),
  occurrenceId: t.Number(),
  occurrenceYear: t.Number(),
  courseUnit: t.Object({ acronym: t.String(), name: t.String() }),
  slots: t.Array(scheduleSlot),
})

export const studentSchedule = t.Object({
  nmec: t.String(),
  classes: t.Array(scheduledClass),
})

export const studentCourseMetadata = t.Object({
  nmec: t.String(),
  courseId: t.Number(),
  festId: t.Number(),
})
