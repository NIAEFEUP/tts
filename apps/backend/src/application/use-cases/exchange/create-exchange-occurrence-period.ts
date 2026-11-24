import type { AdminRepository } from '@/domain/ports/admin.repository'
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { ExchangePeriodsRepository } from '@/domain/ports/exchange-period.repository'
import { authorizeOccurrencePeriod, type OccurrencePeriodInput } from './exchange-period-common'

export function createCreateExchangeOccurrencePeriod(deps: {
  admins: AdminRepository
  occurrences: OccurrenceRepository
  periods: ExchangePeriodsRepository
}) {
  return async function createExchangeOccurrencePeriod(input: OccurrencePeriodInput) {
    const failure = await authorizeOccurrencePeriod(deps, input)
    if (failure) return failure

    const { occurrenceId, occurrenceYear, startsAt, endsAt } = input
    return deps.periods.create({ occurrenceId, occurrenceYear, startsAt, endsAt })
  }
}
