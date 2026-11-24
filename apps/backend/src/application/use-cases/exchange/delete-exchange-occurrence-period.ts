import type { AdminRepository } from '@/domain/ports/admin.repository'
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { ExchangePeriodsRepository } from '@/domain/ports/exchange-period.repository'
import { authorizeOccurrencePeriod, type DeleteOccurrencePeriodInput } from './exchange-period-common'

export function createDeleteOccurrencePeriod(deps: {
  admins: AdminRepository
  occurrences: OccurrenceRepository
  periods: ExchangePeriodsRepository
}) {
  return async function deleteOccurrencePeriod(input: DeleteOccurrencePeriodInput) {
    const failure = await authorizeOccurrencePeriod(deps, input)
    if (failure) return failure

    const { occurrenceId, occurrenceYear, periodId } = input
    return deps.periods.delete({ id: periodId, occurrenceId, occurrenceYear })
  }
}
