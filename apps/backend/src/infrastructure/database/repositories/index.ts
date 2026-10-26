import type { Db } from '@/infrastructure/database/prisma'
import type { CourseRepository } from '@/domain/ports/course.repository'
import type { CourseUnitRepository } from '@/domain/ports/course-unit.repository'
import type { FacultyRepository } from '@/domain/ports/faculty.repository'
import type { OccurrenceRepository } from '@/domain/ports/occurrence.repository'
import type { UserRepository } from '@/domain/ports/user.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import type { StudentRepository } from '@/domain/ports/student.repository'
import type { ScheduleRepository } from '@/domain/ports/schedule.repository'

import { createCourseRepository } from './prisma-course.repository'
import { createCourseUnitRepository } from './prisma-course-unit.repository'
import { createFacultyRepository } from './prisma-faculty.repository'
import { createOccurrenceRepository } from './prisma-occurrence.repository'
import { createUserRepository } from './user.repository'
import { createSessionRepository } from './session.repository'
import { createStudentRepository } from './prisma-student.repository'
import { createScheduleRepository } from './prisma-schedule.repository'

export type Repositories = {
  courseRepository: CourseRepository
  courseUnitRepository: CourseUnitRepository
  facultyRepository: FacultyRepository
  occurrenceRepository: OccurrenceRepository
  userRepository: UserRepository
  sessionRepository: SessionRepository
  studentRepository: StudentRepository
  scheduleRepository: ScheduleRepository
}

export function createRepositories(db: Db): Repositories {
  return {
    courseRepository: createCourseRepository({ db }),
    courseUnitRepository: createCourseUnitRepository({ db }),
    facultyRepository: createFacultyRepository({ db }),
    occurrenceRepository: createOccurrenceRepository({ db }),
    userRepository: createUserRepository({ db }),
    sessionRepository: createSessionRepository({ db }),
    studentRepository: createStudentRepository({ db }),
    scheduleRepository: createScheduleRepository({ db }),
  }
}
