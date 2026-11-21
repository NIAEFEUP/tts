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

  return {
    enrolledCourseUnits: data ?? null,
    error,
    loading: isSessionLoading || isLoading,
    isValidating,
    forceCourseUnitsRevalidation: mutate,
  }
}
