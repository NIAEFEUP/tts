import type { ExchangePeriodsRepository } from '@/domain/ports/exchange-period.repository'
import type { Db } from '@/infrastructure/database/prisma'

export function createExchangePeriodsRepository({ db }: { db: Db }): ExchangePeriodsRepository {
  return {
    // Exchange periods of one occurrence. An occurrence is the
    // `(occurrenceId, occurrenceYear)` pair: Sigarra reuses the id across
    // academic years, so the id alone would return periods from other years.
    async findByOccurrence(occurrenceId, occurrenceYear) {
      // Filtered in the database and ordered by start date, so the result
      // is chronological and deterministic.
      return db.orm.public.ExchangePeriod.where({ occurrenceId, occurrenceYear })
        .orderBy((period) => period.startsAt.asc())
        .all()
    },
  }
}
