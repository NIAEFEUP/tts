import type { AdminRepository } from '@/domain/ports/admin.repository'
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { ExchangePeriodsRepository } from '@/domain/ports/exchange-period.repository'
import {
  authorizeOccurrencePeriod,
  authorizeCoursePeriod,
  type OccurrencePeriodInput,
  type CoursePeriodInput,
} from './exchange-period-common'
import type { CourseRepository } from '@/domain/ports/course.repository'

export function createCreateExchangeOccurrencePeriod(deps: {
  admins: AdminRepository
  occurrences: OccurrenceRepository
  periods: ExchangePeriodsRepository
}) {
  return async function createExchangeOccurrencePeriod(input: OccurrencePeriodInput) {
    const failure = await authorizeOccurrencePeriod(deps, input)
    if (failure) return failure

    const { occurrenceId, occurrenceYear, startsAt, endsAt } = input
    return deps.periods.create({ occurrenceId, occurrenceYear, startsAt, endsAt })
  }
}

export function createCreateExchangeCoursePeriods(deps: {
  admins: AdminRepository
  courses: CourseRepository
  periods: ExchangePeriodsRepository
}) {
  return async function createExchangeCoursePeriods(input: CoursePeriodInput) {
    const failure = await authorizeCoursePeriod(deps, input)
    if (failure) return failure

    const { courseId, startsAt, endsAt } = input
    return deps.periods.createForCourse({
      courseId,
      startsAt,
      endsAt,
    })
  }
}
