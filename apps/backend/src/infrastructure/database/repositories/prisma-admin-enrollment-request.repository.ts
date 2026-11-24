import type {
  AdminEnrollmentRequestDecision,
  AdminEnrollmentRequestFilters,
  AdminEnrollmentRequestPage,
  AdminEnrollmentRequestRepository,
} from '@/domain/ports/admin-enrollment-request.repository'
import type { EnrollmentRequest, EnrollmentRequestOption } from '@/domain/ports/enrollment-request.repository'
import type { Db } from '@/infrastructure/database/prisma'

type OrmClient = { orm: Db['orm'] }
type RequestRow = {
  id: string
  userId: string
  status: EnrollmentRequest['status']
  adminState: EnrollmentRequest['adminState']
  createdAt: { epochMilliseconds: number }
  updatedAt: { epochMilliseconds: number }
}

const REQUEST_COLUMNS = ['id', 'userId', 'status', 'adminState', 'createdAt', 'updatedAt'] as const

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

export function createPrismaAdminEnrollmentRequestRepository({ db }: { db: Db }): AdminEnrollmentRequestRepository {
  return {
    async findForAdmin(adminUserId, filters: AdminEnrollmentRequestFilters): Promise<AdminEnrollmentRequestPage> {
      const links = await db.orm.public.AdminOccurrence.where({ userId: adminUserId }).all()
      if (links.length === 0)
        return { requests: [], page: filters.page, pageSize: filters.pageSize, total: 0, totalPages: 0 }

      const scope = new Set(links.map((link) => `${link.occurrenceId}:${link.occurrenceYear}`))
      const occurrenceIds = [...new Set(links.map((link) => link.occurrenceId))]
      const occurrences = await db.orm.public.Occurrence.where((occurrence) => occurrence.id.in(occurrenceIds)).all()
      const scopedOccurrences = occurrences.filter((occurrence) => scope.has(`${occurrence.id}:${occurrence.year}`))
      if (scopedOccurrences.length === 0)
        return { requests: [], page: filters.page, pageSize: filters.pageSize, total: 0, totalPages: 0 }

      let optionRows = await db.orm.public.EnrollmentRequestOption.where((option) =>
        option.occurrenceId.in([...new Set(scopedOccurrences.map((occurrence) => occurrence.id))]),
      ).all()
      const scopedKeys = new Set(scopedOccurrences.map((occurrence) => `${occurrence.id}:${occurrence.year}`))
      optionRows = optionRows.filter((option) => scopedKeys.has(`${option.occurrenceId}:${option.occurrenceYear}`))
      if (optionRows.length === 0)
        return { requests: [], page: filters.page, pageSize: filters.pageSize, total: 0, totalPages: 0 }

      const requestIds = [...new Set(optionRows.map((option) => option.requestId))]
      let rows = await db.orm.public.EnrollmentRequest.where((request) => request.id.in(requestIds))
        .select(...REQUEST_COLUMNS)
        .orderBy((request) => request.createdAt.desc())
        .all()

      if (filters.activeStates?.length) rows = rows.filter((row) => filters.activeStates!.includes(row.adminState))
      if (filters.activeCourse !== undefined || filters.activeCurricularYear !== undefined) {
        const occurrencesByKey = new Map(
          scopedOccurrences.map((occurrence) => [`${occurrence.id}:${occurrence.year}`, occurrence] as const),
        )
        const unitIds = [...new Set(scopedOccurrences.map((occurrence) => occurrence.courseUnitId))]
        const units = await db.orm.public.CourseUnit.where((unit) => unit.id.in(unitIds)).all()
        const unitsById = new Map(units.map((unit) => [unit.id, unit] as const))
        rows = rows.filter((row) =>
          optionRows
            .filter((option) => option.requestId === row.id)
            .some((option) => {
              const occurrence = occurrencesByKey.get(`${option.occurrenceId}:${option.occurrenceYear}`)
              if (!occurrence) return false
              if (filters.activeCourse !== undefined && occurrence.courseId !== filters.activeCourse) return false
              if (filters.activeCurricularYear !== undefined) {
                const unit = unitsById.get(occurrence.courseUnitId)
                if (!unit || unit.courseUnitYear !== filters.activeCurricularYear) return false
              }
              return true
            }),
        )
      }

      const total = rows.length
      const offset = (filters.page - 1) * filters.pageSize
      return {
        requests: await loadRequests(db, rows.slice(offset, offset + filters.pageSize)),
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
      }
    },

    async acceptForAdmin(adminUserId, id): Promise<AdminEnrollmentRequestDecision> {
      return db.transaction(async (tx) => {
        const row = await tx.orm.public.EnrollmentRequest.where({ id })
          .select(...REQUEST_COLUMNS)
          .first()
        if (!row) return { kind: 'not-found' }
        if (row.status !== 'PENDING') return { kind: 'not-pending' }

        const options = await tx.orm.public.EnrollmentRequestOption.where({ requestId: id }).all()
        const adminLinks = await tx.orm.public.AdminOccurrence.where({ userId: adminUserId }).all()
        if (
          options.length === 0 ||
          options.some(
            (option) =>
              !adminLinks.some(
                (link) => link.occurrenceId === option.occurrenceId && link.occurrenceYear === option.occurrenceYear,
              ),
          )
        )
          return { kind: 'forbidden' }

        for (const option of options) {
          if (option.enrolling) {
            const classes = await tx.orm.public.Class.where((classRow) => classRow.occurrenceId.eq(option.occurrenceId))
              .where((classRow) => classRow.occurrenceYear.eq(option.occurrenceYear))
              .all()
            if (classes.length === 0) {
              return { kind: 'not-pending' }
            }
          }
        }

        const affected = await tx.orm.public.EnrollmentRequest.where({ id, status: 'PENDING' }).updateAndCount({
          status: 'ACCEPTED',
          adminState: 'TREATED',
        })
        if (affected !== 1) return { kind: 'not-pending' }

        for (const option of options) {
          const classes = await tx.orm.public.Class.where((classRow) => classRow.occurrenceId.eq(option.occurrenceId))
            .where((classRow) => classRow.occurrenceYear.eq(option.occurrenceYear))
            .all()

          if (option.enrolling && classes.length > 0) {
            const existing = await tx.orm.public.Enrollment.where({ userId: row.userId }).all()
            const existingIds = new Set(existing.map((enrollment) => enrollment.classId))
            const missing = classes
              .filter((classRow) => !existingIds.has(classRow.id))
              .map((classRow) => ({ userId: row.userId, classId: classRow.id }))
            if (missing.length > 0) await tx.orm.public.Enrollment.createAll(missing)
          } else if (!option.enrolling && classes.length > 0) {
            await tx.orm.public.Enrollment.where({ userId: row.userId })
              .where((enrollment) => enrollment.classId.in(classes.map((classRow) => classRow.id)))
              .delete()
          }
        }

        const updated = await tx.orm.public.EnrollmentRequest.where({ id })
          .select(...REQUEST_COLUMNS)
          .first()
        if (!updated) throw new Error(`Enrollment request ${id} not found after acceptance`)
        const [request] = await loadRequests(tx, [updated])
        if (!request) throw new Error(`Enrollment request ${id} could not be hydrated after acceptance`)
        return { kind: 'ok', request }
      })
    },

    async rejectForAdmin(adminUserId, id): Promise<AdminEnrollmentRequestDecision> {
      return db.transaction(async (tx) => {
        const row = await tx.orm.public.EnrollmentRequest.where({ id })
          .select(...REQUEST_COLUMNS)
          .first()
        if (!row) return { kind: 'not-found' }
        if (row.status !== 'PENDING') return { kind: 'not-pending' }

        const options = await tx.orm.public.EnrollmentRequestOption.where({ requestId: id }).all()
        const adminLinks = await tx.orm.public.AdminOccurrence.where({ userId: adminUserId }).all()
        if (
          options.length === 0 ||
          options.some(
            (option) =>
              !adminLinks.some(
                (link) => link.occurrenceId === option.occurrenceId && link.occurrenceYear === option.occurrenceYear,
              ),
          )
        )
          return { kind: 'forbidden' }

        const affected = await tx.orm.public.EnrollmentRequest.where({ id, status: 'PENDING' }).updateAndCount({
          adminState: 'REJECTED',
        })
        if (affected !== 1) return { kind: 'not-pending' }

        const updated = await tx.orm.public.EnrollmentRequest.where({ id })
          .select(...REQUEST_COLUMNS)
          .first()
        if (!updated) throw new Error(`Enrollment request ${id} not found after rejection`)
        const [request] = await loadRequests(tx, [updated])
        if (!request) throw new Error(`Enrollment request ${id} could not be hydrated after rejection`)
        return { kind: 'ok', request }
      })
    },
  }
}
