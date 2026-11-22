import { client } from '@/api/client'
import type { ClassInfo, CourseInfo, SlotInfo } from '../../@types'
import { getAcademicYear } from '../../utils'

type OccurrenceWithClasses = NonNullable<
  Awaited<ReturnType<ReturnType<typeof client.v1.occurrences>['classes']['get']>>['data']
>

const toCourseInfo = (occurrence: OccurrenceWithClasses): CourseInfo => ({
  id: occurrence.id,
  course: occurrence.courseId,
  course_unit_id: occurrence.id,
  ects: occurrence.ects,
  acronym: occurrence.acronym,
  name: occurrence.name,
  url: occurrence.url,
  hash: occurrence.hash,
  classes: occurrence.classes.map((classInfo): ClassInfo => ({
    id: classInfo.id,
    name: classInfo.name,
    vacancies: classInfo.vacancies ?? undefined,
    filteredTeachers:
      classInfo.filteredTeachers ?? classInfo.slots.flatMap((slot) => slot.professors.map((professor) => professor.id)),
    slots: classInfo.slots.map((slot): SlotInfo => ({
      id: slot.id,
      lesson_type: slot.lessonType,
      day: slot.dayOfWeek - 1,
      start_time: slot.startMinute / 60,
      duration: slot.durationMin / 60,
      location: slot.location ?? '',
      professors: slot.professors.map((professor) => ({
        id: professor.id,
        acronym: professor.acronym ?? '',
        name: professor.name ?? '',
      })),
    })),
  })),
})

const getClasses = async (occurrenceId: number): Promise<CourseInfo> => {
  const { data, error } = await client.v1.occurrences({ id: occurrenceId }).classes.get({
    query: { year: getAcademicYear() },
  })

  if (error) throw error
  return toCourseInfo(data)
}

const occurrenceService = { getClasses }

export default occurrenceService
