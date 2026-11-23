import { or } from '@prisma/orm-postgres/orm-client'

import type {
  ExchangeCycle,
  ExchangeItem,
  ExchangeRepository,
  ExchangeRequest,
  ExchangeRequestFilters,
} from '@/domain/ports/exchange.repository'
import type { Db } from '@/infrastructure/database/prisma'

type InstantLike = { epochMilliseconds: number }

type ExchangeItemRow = {
  userId: string
  occurrenceId: number
  occurrenceYear: number
  fromClassId: number
  toClassId: number
  status: ExchangeItem['status']
  acceptedAt: InstantLike | null
}

type ExchangeCycleRow = {
  id: string
  status: ExchangeCycle['status']
  adminState: ExchangeCycle['adminState']
  origin: ExchangeCycle['origin']
  createdAt: InstantLike
  updatedAt: InstantLike
  items: ExchangeItemRow[]
}

type ExchangeRequestRow = {
  id: string
  creatorId: string
  targetUserId: string | null
  type: ExchangeRequest['type']
  status: ExchangeRequest['status']
  message: string | null
  occurrenceId: number
  occurrenceYear: number
  fromClassId: number
  toClassId: number
  createdAt: InstantLike
  updatedAt: InstantLike
  /** The offer may have produced at most one cycle in the current model. */
  cycles: { cycle: ExchangeCycleRow | null }[]
}

const toDate = (instant: InstantLike) => new Date(instant.epochMilliseconds)

const toNullableDate = (instant: InstantLike | null) => (instant ? toDate(instant) : null)

function mapItem(row: ExchangeItemRow): ExchangeItem {
  return {
    userId: row.userId,
    occurrenceId: row.occurrenceId,
    occurrenceYear: row.occurrenceYear,
    fromClassId: row.fromClassId,
    toClassId: row.toClassId,
    status: row.status,
    acceptedAt: toNullableDate(row.acceptedAt),
  }
}

export function mapExchangeCycle(row: ExchangeCycleRow): ExchangeCycle {
  return {
    id: row.id,
    status: row.status,
    adminState: row.adminState,
    origin: row.origin,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    items: row.items.map(mapItem),
  }
}

export function mapExchangeRequest(row: ExchangeRequestRow): ExchangeRequest {
  const cycle = row.cycles.find((source) => source.cycle !== null)?.cycle ?? null

  return {
    id: row.id,
    creatorId: row.creatorId,
    targetUserId: row.targetUserId,
    type: row.type,
    status: row.status,
    message: row.message,
    occurrenceId: row.occurrenceId,
    occurrenceYear: row.occurrenceYear,
    fromClassId: row.fromClassId,
    toClassId: row.toClassId,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    cycle: cycle ? mapExchangeCycle(cycle) : null,
  }
}

export function createExchangeRepository({ db }: { db: Db }): ExchangeRepository {
  return {
    async findForUser(userId, filters: ExchangeRequestFilters) {
      let query = db.orm.public.ExchangeRequest

      if (filters.role === 'sent') query = query.where({ creatorId: userId })
      else if (filters.role === 'received') query = query.where({ targetUserId: userId })
      else query = query.where((request) => or(request.creatorId.eq(userId), request.targetUserId.eq(userId)))

      if (filters.status) query = query.where({ status: filters.status })
      if (filters.type) query = query.where({ type: filters.type })

      const rows = await query
        .orderBy([(request) => request.createdAt.desc(), (request) => request.id.desc()])
        .limit(filters.limit + 1)
        .offset((filters.page - 1) * filters.limit)
        .include('cycles', (sources) =>
          sources.include('cycle', (cycle) =>
            cycle.include('items', (items) =>
              items.select(
                'userId',
                'occurrenceId',
                'occurrenceYear',
                'fromClassId',
                'toClassId',
                'status',
                'acceptedAt',
              ),
            ),
          ),
        )
        .all()

      const hasNext = rows.length > filters.limit
      const data = rows.slice(0, filters.limit).map(mapExchangeRequest)

      return {
        current: filters.page,
        hasNext,
        hasPrevious: filters.page > 1,
        data,
      }
    },
  }
}
