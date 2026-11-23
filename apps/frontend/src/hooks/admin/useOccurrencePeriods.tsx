import useSWR from 'swr'
import periodService from '../../api/services/periodService'

// An occurrence is (id, year): Sigarra reuses the id across academic years.
// A null key skips the request until an occurrence is selected.
export default (occurrence: { id: number; year: number } | null) =>
  useSWR(occurrence ? ['v1/occurrences', occurrence.id, occurrence.year, 'periods'] : null, () =>
    periodService.getForOccurrence(occurrence.id, occurrence.year),
  )
