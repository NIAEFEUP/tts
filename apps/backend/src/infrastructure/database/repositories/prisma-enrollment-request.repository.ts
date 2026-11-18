import type {
  EnrollmentRequest,
  EnrollmentRequestAdminState,
  EnrollmentRequestOption,
  EnrollmentRequestRepository,
  EnrollmentRequestStatus,
} from '@/domain/ports/enrollment-request.repository'
import type { Db } from '@/infrastructure/database/prisma'

// A request row without its options, as selected from the database. Timestamps
// stay in the driver's Temporal shape here and become Dates when hydrated.
type RequestRow = {
  id: string
  status: EnrollmentRequestStatus
  adminState: EnrollmentRequestAdminState
  createdAt: { epochMilliseconds: number }
  updatedAt: { epochMilliseconds: number }
}

const REQUEST_COLUMNS = ['id', 'status', 'adminState', 'createdAt', 'updatedAt'] as const

/**
 * Attaches options and their occurrence/course-unit data to the selected
 * request rows. One options query and one occurrences query serve every
 * request, so listing N requests never becomes N+1.
 */
async function loadRequests(db: Db, rows: RequestRow[]): Promise<EnrollmentRequest[]> {
  if (rows.length === 0) return []

  const options = await db.orm.public.EnrollmentRequestOption.where((option) =>
    option.requestId.in(rows.map((row) => row.id)),
  )
    .orderBy((option) => option.occurrenceId.asc())
    .all()

  const optionsByRequestId = new Map<string, EnrollmentRequestOption[]>()

  if (options.length > 0) {
    const occurrenceIds = [...new Set(options.map((option) => option.occurrenceId))]
    const occurrences = await db.orm.public.Occurrence.where((occurrence) => occurrence.id.in(occurrenceIds))
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
    status: row.status,
    adminState: row.adminState,
    createdAt: new Date(row.createdAt.epochMilliseconds),
    updatedAt: new Date(row.updatedAt.epochMilliseconds),
    options: optionsByRequestId.get(row.id) ?? [],
  }))
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
      const requestId = await db.transaction(async (tx) => {
        const request = await tx.orm.public.EnrollmentRequest.select('id').create({ userId })

        await tx.orm.public.EnrollmentRequestOption.createAll(
          options.map((option) => ({
            requestId: request.id,
            occurrenceId: option.occurrenceId,
            occurrenceYear: option.occurrenceYear,
            enrolling: option.enrolling,
          })),
        )

        return request.id
      })

      const created = await findById(requestId)
      if (!created) throw new Error(`Enrollment request ${requestId} not found after creation`)

      return created
    },

    async withdraw(id) {
      // Filtering on PENDING makes the withdrawal conditional: if another
      // operation already accepted or cancelled it, no row changes.
      const updated = await db.orm.public.EnrollmentRequest.where({ id, status: 'PENDING' })
        .select('id')
        .update({ status: 'CANCELLED' })

      return updated !== null
    },

    async hasActiveOptionForOccurrence({ userId, occurrenceId, occurrenceYear }) {
      // Cancelled requests are explicitly excluded: a withdrawal must unblock
      // the student from submitting the same occurrence again.
      const activeRequests = await db.orm.public.EnrollmentRequest.where((request) => request.userId.eq(userId))
        .where((request) => request.status.neq('CANCELLED'))
        .select('id')
        .all()

      if (activeRequests.length === 0) return false

      const option = await db.orm.public.EnrollmentRequestOption.where((row) =>
        row.requestId.in(activeRequests.map((request) => request.id)),
      )
        .where((row) => row.occurrenceId.eq(occurrenceId))
        .where((row) => row.occurrenceYear.eq(occurrenceYear))
        .first()

      return option !== null
    },
  }
}
