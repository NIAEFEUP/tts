import useSWR from 'swr'
import adminService from '../../api/services/adminService'

/**
 * Courses the signed-in admin manages (`GET /v1/admin/courses`).
 * An admin with no scope gets an empty list, not an error.
 */
export default () => {
  const { data, error, mutate } = useSWR('v1/admin/courses', adminService.getCourses, {
    shouldRetryOnError: false,
  })

  return {
    courses: data ?? [],
    error: error ?? null,
    loading: !data && !error,
    mutate,
  }
}
