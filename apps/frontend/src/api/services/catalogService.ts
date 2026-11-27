import { client } from '@/api/client'
import { toCourseInfo } from '@/api/services/occurrenceService'
import type { CourseInfo, Major } from '@/@types'

type Course = NonNullable<Awaited<ReturnType<typeof client.v1.courses.get>>['data']>[number]

const toMajor = (course: Course): Major => ({
  id: course.id,
  acronym: course.acronym,
  name: course.name,
  course_type: course.courseType,
  year: course.year,
  url: course.url,
  faculty_id: course.faculties[0] ?? '',
  faculties: course.faculties,
})

/** Lists the catalog courses (majors) for a year — `GET /v1/courses`. */
const listCourses = async ({ year }: { year?: number } = {}): Promise<Major[]> => {
  const { data, error } = await client.v1.courses.get({ query: { year } })
  if (error) throw error
  return data.map(toMajor)
}

/** Lists a course's units for a semester — `GET /v1/courses/:id/occurrences`. */
const getCourseOccurrences = async ({
  courseId,
  year,
  semester,
}: {
  courseId: number
  year: number
  semester: number
}): Promise<CourseInfo[]> => {
  const { data, error } = await client.v1.courses({ id: courseId }).occurrences.get({ query: { year, semester } })

  if (error) throw error

  // the year tabs need units ordered by curricular year
  // the endpoint returns them by academic year then id
  return data.map(toCourseInfo).sort((a, b) => a.course_unit_year - b.course_unit_year)
}

const catalogService = {
  listCourses,
  getCourseOccurrences,
}

export default catalogService
