import useSWR from 'swr'
import { useMemo } from 'react'
import catalogService from '../api/services/catalogService'
import { getAcademicYear } from '../utils'
import type { Major } from '../@types'

/**
 * Loads the course catalog (`GET /v1/courses`) once, only when `enabled` is
 * true (i.e. after the session resolves and the user is signed in). A `null`
 * SWR key disables the request entirely, so signed-out visitors never hit the
 * catalog and never see a 401.
 */
const useCourses = ({ enabled }: { enabled: boolean }) => {
  const year = getAcademicYear()

  const { data, error, mutate, isValidating } = useSWR(
    enabled ? ['v1/courses', year] : null,
    () => catalogService.getCourses({ year }),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // Let the user retry manually instead of auto-retrying, which would
      // fight the manual "Tentar novamente" button (a queued retry plus a
      // click would fire overlapping requests).
      shouldRetryOnError: false,
    },
  )

  const majors: Major[] = useMemo(() => data ?? [], [data])

  return {
    majors,
    error,
    loading: enabled && !data && !error,
    isValidating,
    retry: mutate,
  }
}

export default useCourses
