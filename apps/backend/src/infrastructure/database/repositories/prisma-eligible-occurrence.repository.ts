import type { EligibleOccurrenceRepository } from '@/domain/ports/eligible-occurrence.repository'
import { selectEligible } from '@/domain/services/select-eligible'
import type { Db } from '@/infrastructure/database/prisma'

import { COURSE_UNIT_COLUMNS, toOccurrenceWithUnit } from './occurrence-with-unit'

export function createEligibleOccurrenceRepository({ db }: { db: Db }): EligibleOccurrenceRepository {
  return {
    async findByUserId(userId) {
      const enrollments = await db.orm.public.Enrollment.where({ userId }).all()
      if (enrollments.length === 0) return []

      const classIds = [...new Set(enrollments.map((enrollment) => enrollment.classId))]
      const classes = await db.orm.public.Class.where((classRow) => classRow.id.in(classIds)).all()

      const occurrenceIds = [...new Set(classes.map((classRow) => classRow.occurrenceId))]

      const enrolledOccurrenceKeys = new Set(
        classes.map((classRow) => `${classRow.occurrenceId}:${classRow.occurrenceYear}`),
      )

      // Only the occurrences the student is enrolled in: exchange items are occurrence-scoped
      // (fromClass/toClass share the same (occurrenceId, occurrenceYear)),
      // so another year or course of the same unit is not something they can exchange into.
      const loadedOccurrences = (
        await db.orm.public.Occurrence.where((occurrence) => occurrence.id.in(occurrenceIds))
          .include('courseUnit', (courseUnit) => courseUnit.select(...COURSE_UNIT_COLUMNS))
          .all()
      ).filter((occurrence) => enrolledOccurrenceKeys.has(`${occurrence.id}:${occurrence.year}`))

      const candidateOccurrenceIds = [...new Set(loadedOccurrences.map((occurrence) => occurrence.id))]
      if (candidateOccurrenceIds.length === 0) return []

      const activePeriods = await db.orm.public.ExchangePeriod.where((period) =>
        period.occurrenceId.in(candidateOccurrenceIds),
      ).all()

      const withCourseUnits = loadedOccurrences.map(toOccurrenceWithUnit)

      return selectEligible({ occurrences: withCourseUnits, periods: activePeriods, now: Date.now() })
    },
  }
}
