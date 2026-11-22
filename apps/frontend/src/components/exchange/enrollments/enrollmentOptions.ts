import type { CourseInfo } from '../../../@types'
import type { CreateEnrollmentRequestOption } from '../../../api/services/enrollmentService'

/**
 * Projects the two selection sources onto the enrollment-request payload.
 *
 * The academic year belongs to each occurrence, so it comes from the unit
 * itself rather than from the current clock: a drop can target an older
 * occurrence whose exchange period is still open.
 */
export const toEnrollmentRequestOptions = ({
  enrollCourses,
  dropCourses,
}: {
  enrollCourses: CourseInfo[]
  dropCourses: CourseInfo[]
}): CreateEnrollmentRequestOption[] => [
  ...enrollCourses.map(({ id, occurrenceYear }) => ({
    occurrenceId: id,
    occurrenceYear,
    enrolling: true,
  })),
  ...dropCourses.map(({ id, occurrenceYear }) => ({
    occurrenceId: id,
    occurrenceYear,
    enrolling: false,
  })),
]
