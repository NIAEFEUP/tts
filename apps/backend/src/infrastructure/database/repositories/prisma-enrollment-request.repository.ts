import type {
  CreateEnrollmentRequestOutcome,
  EnrollmentRequest,
  EnrollmentRequestAdminState,
  EnrollmentRequestOption,
  EnrollmentRequestRepository,
  EnrollmentRequestStatus,
  NewEnrollmentRequestOption,
} from '@/domain/ports/enrollment-request.repository'
import type { Db } from '@/infrastructure/database/prisma'

// A request row without its options, as selected from the database. Timestamps
// stay in the driver's Temporal shape here and become Dates when hydrated.
type RequestRow = {
  id: string
  userId: string
  status: EnrollmentRequestStatus
  adminState: EnrollmentRequestAdminState
  createdAt: { epochMilliseconds: number }
  updatedAt: { epochMilliseconds: number }
}

const REQUEST_COLUMNS = ['id', 'userId', 'status', 'adminState', 'createdAt', 'updatedAt'] as const

/** The slice of the client the reads need, shared by `db` and a transaction. */
type OrmClient = { orm: Db['orm'] }

/**
 * Attaches options and their occurrence/course-unit data to the selected
 * request rows. One options query and one occurrences query serve every
 * request, so listing N requests never becomes N+1.
 */
async function loadRequests(client: OrmClient, rows: RequestRow[]): Promise<EnrollmentRequest[]> {
  if (rows.length === 0) return []

  const options = await client.orm.public.EnrollmentRequestOption.where((option) =>
    option.requestId.in(rows.map((row) => row.id)),
  )
    .orderBy((option) => option.occurrenceId.asc())
    .all()

  const optionsByRequestId = new Map<string, EnrollmentRequestOption[]>()

  if (options.length > 0) {
    const occurrenceIds = [...new Set(options.map((option) => option.occurrenceId))]
    const occurrences = await client.orm.public.Occurrence.where((occurrence) => occurrence.id.in(occurrenceIds))
      .include('courseUnit', (courseUnit) => courseUnit.select('id', 'acronym', 'name', 'semester'))
      .all()

    const occurrencesByKey = new Map(
      occurrences.map((occurrence) => [`${occurrence.id}:${occurrence.year}`, occurrence] as const),
    )

    for (const option of options) {
      const occurrence = occurrencesByKey.get(`${option.occurrenceId}:${option.occurrenceYear}`)
      if (!occurrence) {
        throw new Error(`Occurrence ${option.occurrenceId}:${option.occurrenceYear} not found`)
      }
      if (!occurrence.courseUnit) {
        throw new Error(`Course unit for occurrence ${occurrence.id} not found`)
      }

      const view: EnrollmentRequestOption = {
        occurrence: {
          id: occurrence.id,
          year: occurrence.year,
          courseUnit: {
            id: occurrence.courseUnit.id,
            acronym: occurrence.courseUnit.acronym,
            name: occurrence.courseUnit.name,
            semester: occurrence.courseUnit.semester,
          },
        },
        enrolling: option.enrolling,
      }

      const assigned = optionsByRequestId.get(option.requestId)
      if (assigned) assigned.push(view)
      else optionsByRequestId.set(option.requestId, [view])
    }
  }

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    status: row.status,
    adminState: row.adminState,
    createdAt: new Date(row.createdAt.epochMilliseconds),
    updatedAt: new Date(row.updatedAt.epochMilliseconds),
    options: optionsByRequestId.get(row.id) ?? [],
  }))
}

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

    const [request] = await loadRequests(db, [row])
    return request ?? null
  }

  return {
    async findByUserId(userId) {
      const rows = await db.orm.public.EnrollmentRequest.where({ userId })
        .select(...REQUEST_COLUMNS)
        .orderBy((request) => request.createdAt.desc())
        .all()

      return loadRequests(db, rows)
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

        const [created] = await loadRequests(tx, [row])
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
