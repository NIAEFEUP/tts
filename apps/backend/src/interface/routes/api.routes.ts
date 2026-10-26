import { Elysia } from 'elysia'

import { healthRoutes } from './health.routes'
import { facultyRoutes } from './faculties.routes'
import { courseRoutes } from './courses.routes'
import { courseUnitRoutes } from './course-units.routes'
import { authRoutes } from './auth/auth.routes'
import type { AuthRoutesDeps } from './auth/auth.routes'
import { authCompatRoutes } from './auth/auth-compat.routes'
import { studentRoutes } from './students/students.routes'
import type { StudentRoutesDeps } from './students/students.routes'

export type ApiRoutesDeps = AuthRoutesDeps & Omit<StudentRoutesDeps, 'sessions'>

export const createApiRoutes = (deps: ApiRoutesDeps) => {
  return new Elysia()
    .use(healthRoutes)
    .use(facultyRoutes({ sessions: deps.sessions }))
    .use(courseRoutes({ sessions: deps.sessions }))
    .use(courseUnitRoutes({ sessions: deps.sessions }))
    .use(authRoutes(deps))
    .use(authCompatRoutes(deps))
    .use(studentRoutes(deps))
}
