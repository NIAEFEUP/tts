import type {
  AdminEnrollmentRequest,
  AdminEnrollmentRequestDecision,
  AdminEnrollmentRequestFilters,
  AdminEnrollmentRequestPage,
  AdminEnrollmentRequestRepository,
} from '@/domain/ports/admin-enrollment-request.repository'
import type { EnrollmentRequest, EnrollmentRequestAdminState } from '@/domain/ports/enrollment-request.repository'
import type { Db } from '@/infrastructure/database/prisma'
import { REQUEST_COLUMNS, loadEnrollmentRequests, type RequestRow } from './prisma-enrollment-request.utils'

type OrmClient = { orm: Db['orm'] }

// Only these admin states can still be decided. TREATED and REJECTED are final.
const DECIDABLE_ADMIN_STATES: EnrollmentRequestAdminState[] = ['UNTREATED', 'AWAITING_INFORMATION']

function isDecidable(row: RequestRow): boolean {
  return row.status === 'PENDING' && DECIDABLE_ADMIN_STATES.includes(row.adminState)
}

// Adds the student name, one query for the whole page.
async function withUserNames(client: OrmClient, requests: EnrollmentRequest[]): Promise<AdminEnrollmentRequest[]> {
  if (requests.length === 0) return []
  const userIds = [...new Set(requests.map((request) => request.userId))]
  const users = await client.orm.public.User.where((user) => user.id.in(userIds)).all()
  const namesById = new Map(users.map((user) => [user.id, user.name] as const))
  return requests.map((request) => {
    const userName = namesById.get(request.userId)
    if (userName === undefined) throw new Error(`User ${request.userId} not found`)
    return { ...request, userName }
  })
}

async function hydrate(client: OrmClient, rows: RequestRow[]): Promise<AdminEnrollmentRequest[]> {
  return withUserNames(client, await loadEnrollmentRequests(client, rows))
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
        .all()

      // Withdrawn requests are not for the admin to decide, so they are not listed.
      rows = rows.filter((row) => row.status !== 'CANCELLED')

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

      // Newest first. The id breaks ties, so pages stay stable when two requests have the same time.
      rows.sort(
        (a, b) =>
          b.createdAt.epochMilliseconds - a.createdAt.epochMilliseconds || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
      )

      const total = rows.length
      const offset = (filters.page - 1) * filters.pageSize
      const page = await hydrate(db, rows.slice(offset, offset + filters.pageSize))
      return {
        // A request can touch several occurrences. The admin only gets the options inside the scope.
        requests: page.map((request) => ({
          ...request,
          options: request.options.filter((option) =>
            scopedKeys.has(`${option.occurrence.id}:${option.occurrence.year}`),
          ),
        })),
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

        // Scope first, so an admin outside the scope cannot learn the state of the request.
        if (!isDecidable(row)) return { kind: 'not-pending' }

        // Load the classes of each occurrence once and reuse them below.
        const plans = []
        for (const option of options) {
          const classes = await tx.orm.public.Class.where((classRow) => classRow.occurrenceId.eq(option.occurrenceId))
            .where((classRow) => classRow.occurrenceYear.eq(option.occurrenceYear))
            .all()
          // The request is still pending, but it cannot be applied. This is not "not-pending".
          if (option.enrolling && classes.length === 0) return { kind: 'occurrence-has-no-classes' }
          plans.push({ option, classes })
        }

        const affected = await tx.orm.public.EnrollmentRequest.where((request) => request.id.eq(id))
          .where((request) => request.status.eq('PENDING'))
          .where((request) => request.adminState.in(DECIDABLE_ADMIN_STATES))
          .updateAndCount({
            status: 'ACCEPTED',
            adminState: 'TREATED',
          })
        if (affected !== 1) return { kind: 'not-pending' }

        for (const { option, classes } of plans) {
          if (classes.length === 0) continue
          const classIds = classes.map((classRow) => classRow.id)

          if (option.enrolling) {
            // One class per occurrence, so the student sees the course unit once in the schedule.
            // If the student is already in a class of this occurrence, there is nothing to add.
            const existing = await tx.orm.public.Enrollment.where({ userId: row.userId })
              .where((enrollment) => enrollment.classId.in(classIds))
              .all()
            const [target] = [...classes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
            if (existing.length === 0 && target)
              await tx.orm.public.Enrollment.createAll([{ userId: row.userId, classId: target.id }])
          } else {
            await tx.orm.public.Enrollment.where({ userId: row.userId })
              .where((enrollment) => enrollment.classId.in(classIds))
              .deleteAndCount()
          }
        }

        const updated = await tx.orm.public.EnrollmentRequest.where({ id })
          .select(...REQUEST_COLUMNS)
          .first()
        if (!updated) throw new Error(`Enrollment request ${id} not found after acceptance`)
        const [request] = await hydrate(tx, [updated])
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

        // Scope first, so an admin outside the scope cannot learn the state of the request.
        if (!isDecidable(row)) return { kind: 'not-pending' }

        const affected = await tx.orm.public.EnrollmentRequest.where((request) => request.id.eq(id))
          .where((request) => request.status.eq('PENDING'))
          .where((request) => request.adminState.in(DECIDABLE_ADMIN_STATES))
          .updateAndCount({
            adminState: 'REJECTED',
          })
        if (affected !== 1) return { kind: 'not-pending' }

        const updated = await tx.orm.public.EnrollmentRequest.where({ id })
          .select(...REQUEST_COLUMNS)
          .first()
        if (!updated) throw new Error(`Enrollment request ${id} not found after rejection`)
        const [request] = await hydrate(tx, [updated])
        if (!request) throw new Error(`Enrollment request ${id} could not be hydrated after rejection`)
        return { kind: 'ok', request }
      })
    },
  }
}
