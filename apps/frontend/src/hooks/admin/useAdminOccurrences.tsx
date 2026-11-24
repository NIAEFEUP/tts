import useSWR from 'swr'
import adminService from '../../api/services/adminService'

/**
 * Occurrences the signed-in admin manages (`GET /v1/admin/occurrences`).
 * An admin with no scope gets an empty list, not an error.
 */
export default () => {
  const { data, error, mutate } = useSWR('v1/admin/occurrences', adminService.getOccurrences, {
    shouldRetryOnError: false,
  })

  return {
    occurrences: data ?? [],
    error: error ?? null,
    loading: !data && !error,
    mutate,
  }
}
