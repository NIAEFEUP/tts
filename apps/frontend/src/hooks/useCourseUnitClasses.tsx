import { useContext } from 'react'
import useSWR from 'swr'
import SessionContext from '../contexts/SessionContext'
import occurrenceService from '../api/services/occurrenceService'

export default (occurrenceId: number) => {
  const { signedIn } = useContext(SessionContext)
  const key = signedIn && occurrenceId ? ['v1/occurrences', occurrenceId, 'classes'] : null

  const { data, error, mutate, isValidating } = useSWR(
    key,
    ([, id]: [string, number, string]) => occurrenceService.getClasses(id),
    { shouldRetryOnError: false },
  )

  return {
    classes: data?.classes ?? null,
    error: error ?? null,
    loading: Boolean(key && !data && !error),
    isValidating,
    mutate,
  }
}
