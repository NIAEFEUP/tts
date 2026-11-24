import { and } from '@prisma/orm-postgres/orm-client'

import type {
  CourseExchangePeriod,
  ExchangePeriodsRepository,
  ExchangePeriod,
} from '@/domain/ports/exchange-period.repository'
import type { Db } from '@/infrastructure/database/prisma'

type OrmClient = { orm: Db['orm'] }

type PeriodRow = {
  id: string
  occurrenceId: number
  occurrenceYear: number
  startsAt: { epochMilliseconds: number }
  endsAt: { epochMilliseconds: number }
}

const PERIOD_COLUMNS = ['id', 'occurrenceId', 'occurrenceYear', 'startsAt', 'endsAt'] as const

function toExchangePeriod(row: PeriodRow): ExchangePeriod {
  return {
    id: row.id,
    occurrenceId: row.occurrenceId,
    occurrenceYear: row.occurrenceYear,
    startsAt: new Date(row.startsAt.epochMilliseconds),
    endsAt: new Date(row.endsAt.epochMilliseconds),
  }
}

// Pure so tests can run the real selection without a database. `periods` must already be ordered by `startsAt`.
export function selectCourseWindows(
  occurrences: { id: number; year: number }[],
  periods: PeriodRow[],
): CourseExchangePeriod[] {
  const courseOccurences = new Set(occurrences.map((occurrence) => `${occurrence.id}:${occurrence.year}`))
  // The same window is stored once per occurrence, so a course would repeat it.
  // Collapse each window to one representative period. The smallest id wins so
  // the answer does not depend on the order Postgres returns the tied rows in.
  const windows = new Map<string, CourseExchangePeriod>()

  for (const period of periods) {
    if (!courseOccurences.has(`${period.occurrenceId}:${period.occurrenceYear}`)) continue

    const startsAt = new Date(period.startsAt.epochMilliseconds)
    const endsAt = new Date(period.endsAt.epochMilliseconds)
    const key = `${startsAt.getTime()}:${endsAt.getTime()}`
    const seen = windows.get(key)

    if (seen === undefined || period.id < seen.id) {
      windows.set(key, { id: period.id, startsAt, endsAt })
    }
  }
  return [...windows.values()]
}

async function hasOverlap(
  client: OrmClient,
  input: {
    occurrenceId: number
    occurrenceYear: number
    startsAt: Date
    endsAt: Date
    excludingId?: string
  },
): Promise<boolean> {
  const { occurrenceId, occurrenceYear, startsAt, endsAt, excludingId } = input

  const query = client.orm.public.ExchangePeriod.where({ occurrenceId, occurrenceYear }).where((period) =>
    and(period.startsAt.lt(endsAt), period.endsAt.gt(startsAt)),
  )

  const match =
    excludingId === undefined
      ? await query.select('id').first()
      : await query
          .where((period) => period.id.neq(excludingId))
          .select('id')
          .first()

  return match !== null
}

async function hasPendingRequestBackedByPeriod(client: OrmClient, period: PeriodRow): Promise<boolean> {
  const options = await client.orm.public.EnrollmentRequestOption.where({
    occurrenceId: period.occurrenceId,
    occurrenceYear: period.occurrenceYear,
  })
    .select('requestId')
    .all()

  const requestIds = [...new Set(options.map((option) => option.requestId))]
  if (requestIds.length === 0) return false

  const startsAt = new Date(period.startsAt.epochMilliseconds)
  const endsAt = new Date(period.endsAt.epochMilliseconds)

  const pendingRequest = await client.orm.public.EnrollmentRequest.where((request) =>
    and(
      request.id.in(requestIds),
      request.status.eq('PENDING'),
      request.createdAt.gte(startsAt),
      request.createdAt.lte(endsAt),
    ),
  )
    .select('id')
    .first()

  return pendingRequest !== null
}

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
        id: period.id,
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
    async create(input) {
      return db.transaction(async (tx) => {
        const occurrence = await tx.orm.public.Occurrence.where((row) =>
          and(row.id.eq(input.occurrenceId), row.year.eq(input.occurrenceYear)),
        )
          .forNoKeyUpdate()
          .select('id')
          .first()

        if (!occurrence) return { kind: 'not-found' }
        if (await hasOverlap(tx, input)) return { kind: 'overlap' }

        const row = await tx.orm.public.ExchangePeriod.select(...PERIOD_COLUMNS).create(input)
        return { kind: 'created', period: toExchangePeriod(row) }
      })
    },
    async update(input) {
      return db.transaction(async (tx) => {
        const occurrence = await tx.orm.public.Occurrence.where((row) =>
          and(row.id.eq(input.occurrenceId), row.year.eq(input.occurrenceYear)),
        )
          .forNoKeyUpdate()
          .select('id')
          .first()

        if (!occurrence) return { kind: 'not-found' }

        const existing = await tx.orm.public.ExchangePeriod.where({
          id: input.id,
          occurrenceId: input.occurrenceId,
          occurrenceYear: input.occurrenceYear,
        })
          .forUpdate()
          .select(...PERIOD_COLUMNS)
          .first()

        if (!existing) return { kind: 'not-found' }
        if (await hasOverlap(tx, { ...input, excludingId: input.id })) return { kind: 'overlap' }

        const updated = await tx.orm.public.ExchangePeriod.where({
          id: input.id,
          occurrenceId: input.occurrenceId,
          occurrenceYear: input.occurrenceYear,
        })
          .select(...PERIOD_COLUMNS)
          .update({ startsAt: input.startsAt, endsAt: input.endsAt })

        if (!updated) return { kind: 'not-found' }
        return { kind: 'updated', period: toExchangePeriod(updated) }
      })
    },
    async delete(input) {
      return db.transaction(async (tx) => {
        const occurrence = await tx.orm.public.Occurrence.where((row) =>
          and(row.id.eq(input.occurrenceId), row.year.eq(input.occurrenceYear)),
        )
          .forNoKeyUpdate()
          .select('id')
          .first()

        if (!occurrence) return { kind: 'not-found' }

        const period = await tx.orm.public.ExchangePeriod.where(input)
          .forUpdate()
          .select(...PERIOD_COLUMNS)
          .first()

        if (!period) return { kind: 'not-found' }
        if (await hasPendingRequestBackedByPeriod(tx, period)) return { kind: 'pending-requests' }

        await tx.orm.public.ExchangePeriod.where(input).delete()
        return { kind: 'deleted', period: toExchangePeriod(period) }
      })
    },
    async createForCourse({ courseId, startsAt, endsAt }) {
      return db.transaction(async (tx) => {
        const occurrences = await tx.orm.public.Occurrence.where({ courseId })
          .orderBy([(row) => row.id.asc(), (row) => row.year.asc()])
          .forNoKeyUpdate()
          .select('id', 'year')
          .all()

        for (const occurrence of occurrences) {
          if (
            await hasOverlap(tx, {
              occurrenceId: occurrence.id,
              occurrenceYear: occurrence.year,
              startsAt,
              endsAt,
            })
          ) {
            return {
              kind: 'overlap',
              occurrenceId: occurrence.id,
              occurrenceYear: occurrence.year,
            }
          }
        }

        const periods: ExchangePeriod[] = []
        for (const occurrence of occurrences) {
          const row = await tx.orm.public.ExchangePeriod.select(...PERIOD_COLUMNS).create({
            occurrenceId: occurrence.id,
            occurrenceYear: occurrence.year,
            startsAt,
            endsAt,
          })
          periods.push(toExchangePeriod(row))
        }

        return { kind: 'created', periods }
      })
    },
  }
}
