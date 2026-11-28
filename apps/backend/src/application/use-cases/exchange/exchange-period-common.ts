import type { AuthUser } from '@/core/auth/user'
import { isAdmin } from '@/core/auth/user'
import type { AdminRepository } from '@/domain/ports/admin.repository'
import type { CourseRepository } from '@/domain/ports/course.repository'
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'

export type PeriodRange = {
  startsAt: Date
  endsAt: Date
}

export type OccurrencePeriodInput = PeriodRange & {
  user: AuthUser
  occurrenceId: number
  occurrenceYear: number
}

export type UpdateOccurrencePeriodInput = OccurrencePeriodInput & {
  periodId: string
}

export type DeleteOccurrencePeriodInput = {
  user: AuthUser
  occurrenceId: number
  occurrenceYear: number
  periodId: string
}

export type CoursePeriodInput = PeriodRange & {
  user: AuthUser
  courseId: number
}

export type OccurrencePeriodFailure =
  | { kind: 'forbidden' }
  | { kind: 'invalid-period-range' }
  | { kind: 'occurrence-not-found' }

export type CoursePeriodFailure =
  | { kind: 'forbidden' }
  | { kind: 'invalid-period-range' }
  | { kind: 'course-not-found' }

type AuthorizeOccurrencePeriodInput = {
  user: AuthUser
  occurrenceId: number
  occurrenceYear: number
  startsAt?: Date
  endsAt?: Date
}

function hasValidRange({ startsAt, endsAt }: PeriodRange): boolean {
  const startsAtMs = startsAt.getTime()
  const endsAtMs = endsAt.getTime()

  return Number.isFinite(startsAtMs) && Number.isFinite(endsAtMs) && startsAtMs < endsAtMs
}

export async function authorizeOccurrencePeriod(
  deps: { admins: AdminRepository; occurrences: OccurrenceRepository },
  { user, occurrenceId, occurrenceYear, startsAt, endsAt }: AuthorizeOccurrencePeriodInput,
): Promise<OccurrencePeriodFailure | undefined> {
  if (!isAdmin(user)) return { kind: 'forbidden' }
  if (startsAt && endsAt && !hasValidRange({ startsAt, endsAt })) return { kind: 'invalid-period-range' }

  const occurrence = await deps.occurrences.findById(occurrenceId, occurrenceYear)
  if (!occurrence) return { kind: 'occurrence-not-found' }

  if (!(await deps.admins.hasOccurrenceScope(user.id, occurrenceId, occurrenceYear))) {
    return { kind: 'forbidden' }
  }

  return undefined
}

export async function authorizeCoursePeriod(
  deps: { admins: AdminRepository; courses: CourseRepository },
  { user, courseId, startsAt, endsAt }: CoursePeriodInput,
): Promise<CoursePeriodFailure | undefined> {
  if (!isAdmin(user)) return { kind: 'forbidden' }
  if (!hasValidRange({ startsAt, endsAt })) return { kind: 'invalid-period-range' }

  const course = await deps.courses.findById(courseId)
  if (!course) return { kind: 'course-not-found' }

  if (!(await deps.admins.hasCourseScope(user.id, courseId))) {
    return { kind: 'forbidden' }
  }

  return undefined
}
