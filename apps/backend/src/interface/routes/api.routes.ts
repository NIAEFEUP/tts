import { Elysia } from 'elysia'

import { healthRoutes } from './health.routes'
import { scheduleRoutes } from './schedule.routes'
import { facultyRoutes } from './faculties.routes'
import { courseRoutes } from './courses.routes'
import { courseUnitRoutes } from './course-units.routes'
import { authRoutes } from './auth/auth.routes'
import type { AuthRoutesDeps } from './auth/auth.routes'
import { authCompatRoutes } from './auth/auth-compat.routes'
import { enrollmentRoutes } from './users/enrollments.routes'

export const createApiRoutes = (deps: AuthRoutesDeps) => {
  return new Elysia()
    .use(healthRoutes)
    .use(facultyRoutes({ sessions: deps.sessions }))
    .use(courseRoutes({ sessions: deps.sessions }))
    .use(courseUnitRoutes({ sessions: deps.sessions }))
    .use(authRoutes(deps))
    .use(authCompatRoutes(deps))
    .use(enrollmentRoutes(deps.sessions))
    .use(scheduleRoutes({ sessions: deps.sessions }))
}
