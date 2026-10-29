import { client } from '../client'
import type { Major } from '../../@types'

type Course = {
  id: number
  acronym: string
  name: string
  courseType: string
  year: number
  url: string
  faculties: string[]
}

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

const getCourses = async ({ year }: { year?: number } = {}): Promise<Major[]> => {
  const { data, error } = await client.v1.courses.get({ query: { year } })
  if (error) throw error
  return data.map(toMajor)
}

const catalogService = {
  getCourses,
}

export default catalogService
