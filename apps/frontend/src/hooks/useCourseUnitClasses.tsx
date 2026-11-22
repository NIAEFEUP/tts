import { useContext } from 'react'
import useSWR from 'swr'
import SessionContext from '../contexts/SessionContext'
import occurrenceService from '../api/services/occurrenceService'
import { getAcademicYear } from '../utils'

export default (occurrenceId: number, year?: number) => {
  const { signedIn } = useContext(SessionContext)
  const classYear = year ?? getAcademicYear()
  const key = signedIn && occurrenceId ? ['v1/occurrences', occurrenceId, 'classes', classYear] : null

  const { data, error, mutate, isValidating } = useSWR(
    key,
    ([, id, , requestYear]: [string, number, string, number]) => occurrenceService.getClasses(id, requestYear),
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
