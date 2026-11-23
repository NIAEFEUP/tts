import { client } from '../client'
import type { ClassDescriptor } from '../../@types'

type ScheduleEntry = NonNullable<Awaited<ReturnType<typeof client.v1.users.me.schedule.get>>['data']>[number]

// Maps the v1 schedule onto the legacy `ClassDescriptor` the planner and exchange views render.
// Shared with the admin hook (#864), which gets the same `ScheduleEntry[]` shape.
// shortcut: `course`, `course_unit_year`, `ects`, `hash` and `professors_link` are not in
// `ScheduleEntry`, so they are left empty. Open a backend issue if a schedule consumer starts reading them.
export const toClassDescriptor = ({ classId, className, occurrence, slots }: ScheduleEntry): ClassDescriptor => ({
  classInfo: {
    id: classId,
    name: className,
    filteredTeachers: [],
    slots: slots.map((slot) => ({
      id: slot.id,
      lesson_type: slot.lessonType,
      day: (slot.dayOfWeek + 6) % 7, // API: 0 = Sunday; planner: 0 = Monday
      start_time: slot.startMinute / 60,
      duration: slot.durationMin / 60,
      location: slot.location ?? '',
      professors_link: '',
      professors: slot.professors.map((p) => ({ id: p.id, acronym: p.acronym ?? '', name: p.name ?? '' })),
    })),
  },
  courseInfo: {
    // `id` is the Sigarra occurrence id (exchange endpoints still need it).
    // `course_unit_id` is the v1 catalog id (`GET /v1/course-units/:id`).
    id: occurrence.id,
    occurrenceYear: occurrence.year,
    course: 0,
    course_unit_year: 0,
    course_unit_id: occurrence.courseUnit.id,
    ects: 0,
    acronym: occurrence.courseUnit.acronym,
    name: occurrence.courseUnit.name,
    url: occurrence.url,
    hash: '',
  },
})

const getMySchedule = async (): Promise<ClassDescriptor[]> => {
  const { data, error } = await client.v1.users.me.schedule.get()
  if (error) throw error
  return data.map(toClassDescriptor)
}

const scheduleService = {
  getMySchedule,
}

export default scheduleService
