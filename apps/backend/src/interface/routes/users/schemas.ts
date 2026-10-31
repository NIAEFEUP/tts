import { t } from 'elysia'

export const professorSchema = t.Object({
  id: t.Number(),
  acronym: t.Union([t.String(), t.Null()]),
  name: t.Union([t.String(), t.Null()]),
})

export const slotSchema = t.Object({
  id: t.Number(),
  lessonType: t.String(),
  dayOfWeek: t.Number(),
  startMinute: t.Number(),
  durationMin: t.Number(),
  location: t.Union([t.String(), t.Null()]),
  professors: t.Array(professorSchema),
})

export const occurrenceSchema = t.Object({
  id: t.Number(),
  year: t.Number(),
  courseUnit: t.Object({
    id: t.Number(),
    acronym: t.String(),
    name: t.String(),
    semester: t.Number(),
  }),
})

export const scheduleEntrySchema = t.Object({
  classId: t.Number(),
  className: t.String(),
  occurrence: occurrenceSchema,
  slots: t.Array(slotSchema),
})
