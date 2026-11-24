import type { Course } from '@/domain/ports/course.repository'
import type { OccurrenceWithUnit } from '@/domain/ports/occurrence.repository'
import type { AdminRepository } from '@/domain/ports/admin.repository'
import type { Db } from '@/infrastructure/database/prisma'
import { toCourseUnitYear } from './course-unit-mapper'

import { loadCourses } from './course-mapper'

/**
 * The scope comes only from `AdminCourse` and `AdminOccurrence`. Being admin of
 * a course says nothing about its occurrences, so the two reads never touch
 * each other's join table. A user with no rows gets an empty list.
 */
export function createAdminRepository({ db }: { db: Db }): AdminRepository {
  return {
    // GET /v1/admin/courses: courses in the admin's AdminCourse scope.
    // `loadCourses` already orders by acronym and attaches the faculties.
    async findCoursesByAdmin(userId): Promise<Course[]> {
      const links = await db.orm.public.AdminCourse.where({ userId }).all()
      if (links.length === 0) return []

      return loadCourses(db, { ids: links.map((link) => link.courseId) })
    },

    // GET /v1/admin/occurrences: occurrences in the admin's AdminOccurrence
    // scope, with the course unit's acronym and name.
    async findOccurrencesByAdmin(userId): Promise<OccurrenceWithUnit[]> {
      const links = await db.orm.public.AdminOccurrence.where({ userId }).all()
      if (links.length === 0) return []

      const scope = new Set(links.map((link) => `${link.occurrenceId}:${link.occurrenceYear}`))
      const occurrenceIds = [...new Set(links.map((link) => link.occurrenceId))]

      const candidates = await db.orm.public.Occurrence.where((occurrence) => occurrence.id.in(occurrenceIds)).all()
      const occurrences = candidates.filter((occurrence) => scope.has(`${occurrence.id}:${occurrence.year}`))
      if (occurrences.length === 0) return []

      const courseUnitIds = [...new Set(occurrences.map((occurrence) => occurrence.courseUnitId))]
      const courseUnits = await db.orm.public.CourseUnit.where((unit) => unit.id.in(courseUnitIds))
        .select('id', 'acronym', 'name', 'courseUnitYear')
        .all()
      const courseUnitsById = new Map(courseUnits.map((unit) => [unit.id, unit] as const))

      return occurrences
        .map((occurrence) => {
          const courseUnit = courseUnitsById.get(occurrence.courseUnitId)
          if (!courseUnit) throw new Error(`Course unit ${occurrence.courseUnitId} not found`)

          return {
            id: occurrence.id,
            courseUnitId: occurrence.courseUnitId,
            courseId: occurrence.courseId,
            year: occurrence.year,
            ects: occurrence.ects,
            url: occurrence.url,
            hash: occurrence.hash,
            acronym: courseUnit.acronym,
            name: courseUnit.name,
            courseUnitYear: toCourseUnitYear(courseUnit.courseUnitYear),
          }
        })
        .sort((a, b) => b.year - a.year || a.id - b.id)
    },

    async hasCourseScope(userId, courseId) {
      const scope = await db.orm.public.AdminCourse.where({ userId, courseId }).select('courseId').first()

      return scope !== null
    },
    
    async hasOccurrenceScope(userId, occurrenceId, occurrenceYear) {
      const scope = await db.orm.public.AdminOccurrence.where({
        userId,
        occurrenceId,
        occurrenceYear,
      })
        .select('occurrenceId')
        .first()

      return scope !== null
    },
  }
}
