import useSWR from 'swr'
import periodService from '../../api/services/periodService'

// A null key skips the request until a course is selected.
export default (courseId: number | null) =>
  useSWR(courseId === null ? null : ['v1/courses', courseId, 'periods'], () => periodService.getForCourse(courseId))
