import type {
  EnrollmentRequest,
  EnrollmentRequestAdminState,
  EnrollmentRequestOption,
  EnrollmentRequestStatus,
} from '@/domain/ports/enrollment-request.repository'
import type { Db } from '@/infrastructure/database/prisma'

export type RequestRow = {
  id: string
  userId: string
  status: EnrollmentRequestStatus
  adminState: EnrollmentRequestAdminState
  createdAt: { epochMilliseconds: number }
  updatedAt: { epochMilliseconds: number }
}

export const REQUEST_COLUMNS = ['id', 'userId', 'status', 'adminState', 'createdAt', 'updatedAt'] as const

type OrmClient = { orm: Db['orm'] }

export async function loadEnrollmentRequests(client: OrmClient, rows: RequestRow[]): Promise<EnrollmentRequest[]> {
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
      if (!occurrence?.courseUnit)
        throw new Error(`Occurrence ${option.occurrenceId}:${option.occurrenceYear} not found`)

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
