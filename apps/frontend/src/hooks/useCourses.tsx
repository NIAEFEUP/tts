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

  const { data, error, mutate } = useSWR(
    enabled ? ['v1/courses', year] : null,
    () => catalogService.getCourses({ year }),
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // Retry transient failures quietly, but cap them so a down backend does
      // not loop forever (which would keep producing fresh error objects).
      shouldRetryOnError: true,
      errorRetryCount: 3,
    },
  )

  const majors: Major[] = useMemo(() => data ?? [], [data])

  return {
    majors,
    error,
    loading: enabled && !data && !error,
    retry: mutate,
  }
}

export default useCourses
