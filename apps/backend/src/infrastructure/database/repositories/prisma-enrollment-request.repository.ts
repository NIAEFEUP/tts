import type {
  CreateEnrollmentRequestOutcome,
  EnrollmentRequest,
  EnrollmentRequestRepository,
  NewEnrollmentRequestOption,
} from '@/domain/ports/enrollment-request.repository'
import type { Db } from '@/infrastructure/database/prisma'
import { REQUEST_COLUMNS, loadEnrollmentRequests } from './prisma-enrollment-request.utils'

/** The slice of the client the reads need, shared by `db` and a transaction. */
type OrmClient = { orm: Db['orm'] }

/**
 * The first incoming option that already exists on one of the student's
 * non-cancelled requests. Cancelled requests are excluded so a withdrawal
 * unblocks resubmission, and `enrolling` is ignored: one active intent per
 * occurrence is enough.
 */
async function findActiveDuplicate(
  client: OrmClient,
  userId: string,
  options: NewEnrollmentRequestOption[],
): Promise<{ occurrenceId: number; occurrenceYear: number } | null> {
  const activeRequests = await client.orm.public.EnrollmentRequest.where((request) => request.userId.eq(userId))
    .where((request) => request.status.neq('CANCELLED'))
    .select('id')
    .all()

  if (activeRequests.length === 0) return null

  const activeOptions = await client.orm.public.EnrollmentRequestOption.where((option) =>
    option.requestId.in(activeRequests.map((request) => request.id)),
  )
    .select('occurrenceId', 'occurrenceYear')
    .all()

  const activeKeys = new Set(activeOptions.map((option) => `${option.occurrenceId}:${option.occurrenceYear}`))

  for (const option of options) {
    if (activeKeys.has(`${option.occurrenceId}:${option.occurrenceYear}`)) {
      return { occurrenceId: option.occurrenceId, occurrenceYear: option.occurrenceYear }
    }
  }

  return null
}

export function createEnrollmentRequestRepository({ db }: { db: Db }): EnrollmentRequestRepository {
  async function findById(id: string): Promise<EnrollmentRequest | null> {
    const row = await db.orm.public.EnrollmentRequest.where({ id })
      .select(...REQUEST_COLUMNS)
      .first()

    if (!row) return null

    const [request] = await loadEnrollmentRequests(db, [row])
    return request ?? null
  }

  return {
    async findByUserId(userId) {
      const rows = await db.orm.public.EnrollmentRequest.where({ userId })
        .select(...REQUEST_COLUMNS)
        .orderBy((request) => request.createdAt.desc())
        .all()

      return loadEnrollmentRequests(db, rows)
    },

    findById,

    async create({ userId, options }) {
      return db.transaction(async (tx): Promise<CreateEnrollmentRequestOutcome> => {
        // Serialize submissions for the same student. `forNoKeyUpdate` blocks
        // a second transaction here while still allowing the `FOR KEY SHARE`
        // taken by EnrollmentRequest's foreign-key check on this user row.
        const user = await tx.orm.public.User.where({ id: userId }).forNoKeyUpdate().select('id').first()
        if (!user) throw new Error(`User ${userId} not found`)

        // Authoritative duplicate check: it runs after the lock and in the
        // same transaction as the insert, so two concurrent requests cannot
        // both create an active option for the same occurrence.
        const duplicate = await findActiveDuplicate(tx, userId, options)
        if (duplicate) return { kind: 'duplicate', ...duplicate }

        const request = await tx.orm.public.EnrollmentRequest.select('id').create({ userId })

        await tx.orm.public.EnrollmentRequestOption.createAll(
          options.map((option) => ({
            requestId: request.id,
            occurrenceId: option.occurrenceId,
            occurrenceYear: option.occurrenceYear,
            enrolling: option.enrolling,
          })),
        )

        // Hydrate before committing: if this read fails, the request and its
        // options roll back together and the student can retry safely.
        const row = await tx.orm.public.EnrollmentRequest.where({ id: request.id })
          .select(...REQUEST_COLUMNS)
          .first()
        if (!row) throw new Error(`Enrollment request ${request.id} not found after creation`)

        const [created] = await loadEnrollmentRequests(tx, [row])
        if (!created) throw new Error(`Enrollment request ${request.id} could not be hydrated`)

        return { kind: 'created', request: created }
      })
    },

    async withdraw(id) {
      // `updateAndCount` keeps the filter on the write itself, unlike scalar
      // `update()` which first selects a row and then writes by its identity.
      // Two concurrent withdrawals therefore cannot both change the row: only
      // the one that matches `status = PENDING` reports an affected row.
      const affected = await db.orm.public.EnrollmentRequest.where({ id, status: 'PENDING' }).updateAndCount({
        status: 'CANCELLED',
      })

      return affected === 1
    },
  }
}
