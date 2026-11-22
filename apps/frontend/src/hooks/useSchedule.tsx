import { useContext } from 'react'
import useSWR from 'swr'
import scheduleService from '../api/services/scheduleService'
import SessionContext from '../contexts/SessionContext'

export default () => {
  const { signedIn, user } = useContext(SessionContext)
  // `null` key: anonymous visitors make no request. The user id in the key keeps
  // one account's cached schedule from showing up for the next one.
  const { data, error, mutate, isLoading, isValidating } = useSWR(
    signedIn ? ['schedule', user?.username] : null,
    () => scheduleService.getMySchedule(),
    // Don't hammer a failing endpoint; /exchange has no error UI yet.
    { shouldRetryOnError: false },
  )

  return {
    schedule: data ?? null,
    error,
    loading: isLoading,
    isValidating,
    mutate,
  }
}
