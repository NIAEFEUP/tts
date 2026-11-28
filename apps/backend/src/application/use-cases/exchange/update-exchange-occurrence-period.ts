import type { AdminRepository } from '@/domain/ports/admin.repository'
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { ExchangePeriodsRepository } from '@/domain/ports/exchange-period.repository'
import { authorizeOccurrencePeriod, type UpdateOccurrencePeriodInput } from './exchange-period-common'

export function createUpdateExchangeOccurrencePeriod(deps: {
  admins: AdminRepository
  occurrences: OccurrenceRepository
  periods: ExchangePeriodsRepository
}) {
  return async function updateOccurrencePeriod(input: UpdateOccurrencePeriodInput) {
    const failure = await authorizeOccurrencePeriod(deps, input)
    if (failure) return failure

    const { occurrenceId, occurrenceYear, periodId, startsAt, endsAt } = input
    return deps.periods.update({
      id: periodId,
      occurrenceId,
      occurrenceYear,
      startsAt,
      endsAt,
    })
  }
}
