import { useContext } from 'react'
import useSWR from 'swr'
import scheduleService from '../api/services/scheduleService'
import SessionContext from '../contexts/SessionContext'

export default () => {
  const { signedIn } = useContext(SessionContext)
  // `null` key: anonymous visitors make no request.
  const { data, error, mutate, isLoading, isValidating } = useSWR(
    signedIn ? 'schedule' : null,
    scheduleService.getMySchedule,
  )

  return {
    schedule: data ?? null,
    error,
    loading: isLoading,
    isValidating,
    mutate,
  }
}
