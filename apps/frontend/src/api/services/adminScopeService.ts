import { client } from '@/api/client'

const getCourses = async () => {
  const { data, error } = await client.v1.admin.courses.get()

  if (error) throw error
  return data
}

const getOccurrences = async () => {
  const { data, error } = await client.v1.admin.occurrences.get()

  if (error) throw error
  return data
}

const adminScopeService = { getCourses, getOccurrences }

export default adminScopeService
