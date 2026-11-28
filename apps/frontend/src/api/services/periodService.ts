import { client } from '@/api/client'

const getForCourse = async (courseId: number) => {
  const { data, error } = await client.v1.courses({ id: courseId }).periods.get()

  if (error) throw error
  return data
}

const getForOccurrence = async (occurrenceId: number, year: number) => {
  const { data, error } = await client.v1.occurrences({ id: occurrenceId }).periods.get({ query: { year } })

  if (error) throw error
  return data
}

// Both routes share the backend period schema, so one element type covers them.
export type ExchangePeriod = Awaited<ReturnType<typeof getForCourse>>[number]

const periodService = { getForCourse, getForOccurrence }

export default periodService
