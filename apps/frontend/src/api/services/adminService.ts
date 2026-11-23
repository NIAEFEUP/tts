import { client } from '@/api/client'

type AdminCourse = NonNullable<Awaited<ReturnType<typeof client.v1.admin.courses.get>>['data']>[number]
type AdminOccurrence = NonNullable<Awaited<ReturnType<typeof client.v1.admin.occurrences.get>>['data']>[number]

/**
 * Courses the signed-in admin manages — `GET /v1/admin/courses`.
 * Ordered by acronym; an admin with no scope gets an empty list.
 */
const getCourses = async (): Promise<AdminCourse[]> => {
  const { data, error } = await client.v1.admin.courses.get()
  if (error) throw error
  return data
}

/**
 * Occurrences the signed-in admin manages — `GET /v1/admin/occurrences`.
 * Ordered by year (newest first) then id; an admin with no scope gets an empty list.
 */
const getOccurrences = async (): Promise<AdminOccurrence[]> => {
  const { data, error } = await client.v1.admin.occurrences.get()
  if (error) throw error
  return data
}

const adminService = {
  getCourses,
  getOccurrences,
}

export type { AdminCourse, AdminOccurrence }
export default adminService
