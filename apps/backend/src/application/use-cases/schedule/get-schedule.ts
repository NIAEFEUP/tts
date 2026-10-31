import type { EnrollmentRepository, StudentEnrollment } from '@/domain/ports/enrollment.repository'

export type ScheduleEntry = {
  classId: number
  className: string
  occurrence: StudentEnrollment['occurrence']
  slots: StudentEnrollment['class']['slots']
}

export function createGetSchedule(deps: { enrollments: EnrollmentRepository }) {
  return async function GetSchedule(userId: string): Promise<ScheduleEntry[]> {
    const enrollments = await deps.enrollments.findByUserId(userId)

    return enrollments.map(({ occurrence, class: classRow }) => ({
      classId: classRow.id,
      className: classRow.name,
      occurrence,
      slots: [...classRow.slots.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute)],
    }))
  }
}
