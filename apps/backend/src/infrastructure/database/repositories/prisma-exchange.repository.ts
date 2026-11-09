import { or } from '@prisma/orm-postgres/orm-client'

import type { ExchangeRepository, ExchangeRequestFilters } from '@/domain/ports/exchange.repository'
import type { Db } from '@/infrastructure/database/prisma'

export function createExchangeRepository({ db }: { db: Db }): ExchangeRepository {
  return {
    async findForUser(userId, filters: ExchangeRequestFilters) {
      let query = db.orm.public.ExchangeRequest

      if (filters.role === 'sent') query = query.where({ creatorId: userId })
      else if (filters.role === 'received') query = query.where({ targetUserId: userId })
      else query = query.where((request) => or(request.creatorId.eq(userId), request.targetUserId.eq(userId)))

      if (filters.status) query = query.where({ status: filters.status })
      if (filters.type) query = query.where({ type: filters.type })

      query = query
        .orderBy((request) => request.createdAt.desc())
        .limit(filters.limit + 1)
        .offset((filters.page - 1) * filters.limit)

      const rows = await query
        .include('items', (items) =>
          items.select('userId', 'occurrenceId', 'occurrenceYear', 'fromClassId', 'toClassId', 'accepted'),
        )
        .all()

      const hasNext = rows.length > filters.limit
      const data = rows.slice(0, filters.limit)

      return {
        current: filters.page,
        hasNext,
        hasPrevious: filters.page > 1,
        data,
      }
    },
  }
}
