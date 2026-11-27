import { client } from '@/api/client'
import type { ClassInfo, CourseInfo, SlotInfo } from '@/@types'
import { getAcademicYear } from '@/utils'

type Occurrence = NonNullable<
  Awaited<ReturnType<ReturnType<typeof client.v1.courses>['occurrences']['get']>>['data']
>[number]
type OccurrenceWithClasses = NonNullable<
  Awaited<ReturnType<ReturnType<typeof client.v1.occurrences>['classes']['get']>>['data']
>

/** Maps an occurrence row (course unit fields joined in) to the planner's `CourseInfo`. */
export const toCourseInfo = (occurrence: Occurrence): CourseInfo => ({
  id: occurrence.id,
  course: occurrence.courseId,
  occurrenceYear: occurrence.year,
  course_unit_year: occurrence.courseUnitYear,
  course_unit_id: occurrence.courseUnitId,
  ects: occurrence.ects,
  acronym: occurrence.acronym,
  name: occurrence.name,
  url: occurrence.url,
  hash: occurrence.hash,
})

const toCourseInfoWithClasses = (occurrence: OccurrenceWithClasses): CourseInfo => ({
  ...toCourseInfo(occurrence),
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

const getClasses = async (occurrenceId: number, year = getAcademicYear()): Promise<CourseInfo> => {
  const { data, error } = await client.v1.occurrences({ id: occurrenceId }).classes.get({
    query: { year },
  })

  if (error) throw error
  return toCourseInfoWithClasses(data)
}

const occurrenceService = { getClasses }

export default occurrenceService
