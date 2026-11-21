import type { CourseInfo } from '../../@types'
import { client } from '../client'

type EligibleOccurrence = NonNullable<
  Awaited<ReturnType<(typeof client.v1.users.me)['eligible-occurrences']['get']>>['data']
>[number]

const errorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'error' in error) return String(error.error)
  return 'Erro ao carregar as unidades curriculares'
}

/**
 * Maps an occurrence-oriented eligible unit onto the `CourseInfo` shape the
 * exchange components already consume.
 *
 * `id` stays the Sigarra occurrence id, matching what the legacy exchange
 * endpoints already received. `course_unit_id` is the catalog's internal course
 * unit id; no exchange component reads it today.
 */
const toCourseInfo = (occurrence: EligibleOccurrence): CourseInfo => ({
  id: occurrence.id,
  course: occurrence.courseId,
  course_unit_id: occurrence.courseUnitId,
  course_unit_year: occurrence.courseUnitYear,
  ects: occurrence.ects,
  acronym: occurrence.acronym,
  name: occurrence.name,
  url: occurrence.url,
  hash: occurrence.hash,
})

const getEligibleOccurrences = async (): Promise<CourseInfo[]> => {
  const { data, error } = await client.v1.users.me['eligible-occurrences'].get()
  if (error) throw new Error(errorMessage(error))
  return data.map(toCourseInfo)
}

const studentService = {
  getEligibleOccurrences,
}

export default studentService
