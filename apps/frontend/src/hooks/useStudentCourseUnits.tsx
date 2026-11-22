import { useContext } from 'react'
import useSWR from 'swr'

import studentService from '../api/services/studentService'
import SessionContext from '../contexts/SessionContext'

const ELIGIBLE_OCCURRENCES_KEY = ['v1/users/me/eligible-occurrences'] as const

export default () => {
  const { signedIn, isSessionLoading } = useContext(SessionContext)

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    signedIn ? ELIGIBLE_OCCURRENCES_KEY : null,
    studentService.getEligibleOccurrences,
  )

  // SWR keeps the last successful response when a background revalidation
  // fails, so `data` and `error` can both be set. Only a failure with nothing
  // cached is a page-level error; otherwise keep rendering the cached list.

  const loaded = data !== undefined

  return {
    enrolledCourseUnits: data ?? null,
    error: loaded ? null : (error ?? null),
    loading: isSessionLoading || isLoading,
    isValidating,
    forceCourseUnitsRevalidation: mutate,
  }
}
