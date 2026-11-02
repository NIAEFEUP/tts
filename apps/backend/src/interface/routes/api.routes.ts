import { Elysia } from 'elysia'

import { healthRoutes } from './health.routes'
import { scheduleRoutes } from './users/schedule.routes'
import { facultyRoutes } from './faculties.routes'
import { courseRoutes } from './courses.routes'
import { courseUnitRoutes } from './course-units.routes'
import { occurrenceRoutes } from './occurrences.routes'
import { authRoutes } from './auth/auth.routes'
import type { AuthRoutesDeps } from './auth/auth.routes'
import { authCompatRoutes } from './auth/auth-compat.routes'
import { studentRoutes } from './students/students.routes'
import type { StudentRoutesDeps } from './students/students.routes'
import { enrollmentRoutes } from './users/enrollments.routes'

export type ApiRoutesDeps = AuthRoutesDeps & Omit<StudentRoutesDeps, 'sessions'>

export const createApiRoutes = (deps: ApiRoutesDeps) => {
  return new Elysia()
    .use(healthRoutes)
    .use(facultyRoutes({ sessions: deps.sessions }))
    .use(courseRoutes({ sessions: deps.sessions }))
    .use(courseUnitRoutes({ sessions: deps.sessions }))
    .use(occurrenceRoutes({ sessions: deps.sessions }))
    .use(authRoutes(deps))
    .use(authCompatRoutes(deps))
    .use(studentRoutes(deps))
    .use(enrollmentRoutes(deps.sessions))
    .use(scheduleRoutes({ sessions: deps.sessions }))
}
