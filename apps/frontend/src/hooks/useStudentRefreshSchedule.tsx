import { useContext } from 'react'
import useSWR from 'swr'
import studentScheduleRequestService from '../api/services/studentScheduleRequestService'
import SessionContext from '../contexts/SessionContext'

export default () => {
  const getEligibileCourseUnits = async () => {
    try {
      const res = await studentScheduleRequestService.refreshSchedule()

      if (res.ok) {
        return await res.json()
      }

      return []
    } catch (e) {
      console.error(e)
      return []
    }
  }

  const { signedIn } = useContext(SessionContext)
  // `null` key: anonymous visitors make no request.
  const { data, error, mutate, isValidating } = useSWR(
    signedIn ? 'refresh-student-schedule' : null,
    getEligibileCourseUnits,
    {},
  )

  return {
    refreshedSchedule: data,
    error,
    forceRefreshStudentSchedule: mutate,
    isRefreshingStudentSchedule: isValidating,
  }
}
