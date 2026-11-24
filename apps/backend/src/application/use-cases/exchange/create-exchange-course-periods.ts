import type { AdminRepository } from '@/domain/ports/admin.repository'
import type { CourseRepository } from '@/domain/ports/course.repository'
import type { ExchangePeriodsRepository } from '@/domain/ports/exchange-period.repository'
import { authorizeCoursePeriod, type CoursePeriodInput } from './exchange-period-common'

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
      courseId: String(courseId),
      startsAt,
      endsAt,
    })
  }
}
