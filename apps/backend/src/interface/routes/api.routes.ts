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
import { enrollmentRoutes } from './users/enrollments.routes'
import { eligibleOccurrencesRoutes } from './users/eligible-occurrences.routes'
import { enrollmentRequestRoutes } from './enrollment-requests/enrollment-requests.routes'
import { studentRoutes } from './students/students.routes'
import { meRoutes } from './users/me.routes'
import { classRoutes } from './class.routes'
import { slotRoutes } from './slots.routes'
import { exchangeRoutes } from './users/exchanges.routes'
import { adminScopeRoutes } from './admin/admin.routes'
import { adminEnrollmentRequestRoutes } from './admin/admin-enrollment-requests.routes'

export const createApiRoutes = (deps: AuthRoutesDeps) => {
  return new Elysia()
    .use(healthRoutes)
    .use(facultyRoutes({ sessions: deps.sessions }))
    .use(courseRoutes({ sessions: deps.sessions }))
    .use(courseUnitRoutes({ sessions: deps.sessions }))
    .use(occurrenceRoutes({ sessions: deps.sessions }))
    .use(authRoutes(deps))
    .use(authCompatRoutes(deps))
    .use(meRoutes({ sessions: deps.sessions }))
    .use(enrollmentRoutes(deps.sessions))
    .use(eligibleOccurrencesRoutes(deps.sessions))
    .use(enrollmentRequestRoutes({ sessions: deps.sessions }))
    .use(scheduleRoutes({ sessions: deps.sessions }))
    .use(studentRoutes({ sessions: deps.sessions }))
    .use(classRoutes({ sessions: deps.sessions }))
    .use(slotRoutes({ sessions: deps.sessions }))
    .use(exchangeRoutes(deps.sessions))
    .use(adminScopeRoutes({ sessions: deps.sessions }))
    .use(adminEnrollmentRequestRoutes({ sessions: deps.sessions }))
}
