import { useContext } from 'react'
import useSWR from 'swr'
import { ENV } from 'varlock/env'
import SessionContext from '@/contexts/SessionContext'
import catalogService from '@/api/services/catalogService'
import { getAcademicYear, getSemester } from '@/utils'

/** Course units a course offers this semester — `GET /v1/courses/:id/occurrences`. */
export default (courseId: number | null) => {
  const { signedIn, isSessionLoading } = useContext(SessionContext)
  const year = getAcademicYear()
  const semester = Number(ENV.VITE_APP_SEMESTER) || getSemester()
  const key = signedIn && courseId ? ['v1/courses', courseId, 'occurrences', year, semester] : null

  const { data, error, mutate } = useSWR(
    key,
    ([, id, , requestYear, requestSemester]: [string, number, string, number, number]) =>
      catalogService.getCourseOccurrences({ courseId: id, year: requestYear, semester: requestSemester }),
    { revalidateIfStale: false, revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false },
  )

  return {
    courseUnits: data ?? null,
    error: error ?? null,
    loading: isSessionLoading || Boolean(key && !data && !error),
    mutate,
  }
}
