import type { ScheduleSync } from '@/domain/ports/schedule-sync'
import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'

export type RefreshScheduleDeps = {
  sync: ScheduleSync
  enrollments: EnrollmentRepository
}

export function createRefreshSchedule(deps: RefreshScheduleDeps) {
  return async function refreshSchedule(userId: string) {
    const latest = await deps.sync.fetchEnrollments(userId)
    if (!deps.enrollments.replaceForUser) throw new Error('Enrollment replacement is not configured')
    await deps.enrollments.replaceForUser(userId, latest)
    return { refreshed: true, enrollmentCount: latest.length }
  }
}
