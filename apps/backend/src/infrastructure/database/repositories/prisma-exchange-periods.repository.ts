import type { CourseExchangePeriod, ExchangePeriodsRepository } from '@/domain/ports/exchange-period.repository'
import type { Db } from '@/infrastructure/database/prisma'

export function createExchangePeriodsRepository({ db }: { db: Db }): ExchangePeriodsRepository {
  return {
    // Exchange periods of one occurrence. An occurrence is the
    // `(occurrenceId, occurrenceYear)` pair: Sigarra reuses the id across
    // academic years, so the id alone would return periods from other years.
    async findByOccurrence(occurrenceId, occurrenceYear) {
      // Filtered in the database and ordered by start date, so the result
      // is chronological and deterministic.
      const periods = await db.orm.public.ExchangePeriod.where({ occurrenceId, occurrenceYear })
        .orderBy((period) => period.startsAt.asc())
        .all()

      return periods.map((period) => ({
        occurrenceId: period.occurrenceId,
        occurrenceYear: period.occurrenceYear,
        startsAt: new Date(period.startsAt.epochMilliseconds),
        endsAt: new Date(period.endsAt.epochMilliseconds),
      }))
    },
    // Distinct windows across all occurrences of a course: opening a course
    // creates the same window on each occurrence, so the same dates repeat.
    async findByCourse(courseId) {
      const occurrences = await db.orm.public.Occurrence.where({ courseId }).all()
      if (occurrences.length === 0) return []

      // query all occurrences periods of the course
      const ids = [...new Set(occurrences.map((occurrence) => occurrence.id))]
      const periods = await db.orm.public.ExchangePeriod.where((period) => period.occurrenceId.in(ids))
        .orderBy((period) => period.startsAt.asc())
        .all()

      return selectCourseWindows(occurrences, periods)
    },
  }
}

type PeriodRow = {
  occurrenceId: number
  occurrenceYear: number
  startsAt: { epochMilliseconds: number }
  endsAt: { epochMilliseconds: number }
}

// Pure so tests can run the real selection without a database. `periods` must already be ordered by `startsAt`.
export function selectCourseWindows(
  occurrences: { id: number; year: number }[],
  periods: PeriodRow[],
): CourseExchangePeriod[] {
  const courseOccurences = new Set(occurrences.map((occurrence) => `${occurrence.id}:${occurrence.year}`))
  const periodsSeen = new Set<string>()
  const courseExchangePeriod: CourseExchangePeriod[] = []

  for (const period of periods) {
    if (!courseOccurences.has(`${period.occurrenceId}:${period.occurrenceYear}`)) continue

    const startsAt = new Date(period.startsAt.epochMilliseconds)
    const endsAt = new Date(period.endsAt.epochMilliseconds)
    const key = `${startsAt.getTime()}:${endsAt.getTime()}`

    // skip periods already seen
    if (periodsSeen.has(key)) continue

    periodsSeen.add(key)
    courseExchangePeriod.push({ startsAt, endsAt })
  }
  return courseExchangePeriod
}
