import type { EligibleOccurrenceRepository } from '@/domain/ports/eligible-occurrence.repository'
import { selectEligible } from '@/domain/services/select-eligible'
import type { Db } from '@/infrastructure/database/prisma'

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
          .include('courseUnit', (courseUnit) => courseUnit.select('acronym', 'name', 'courseUnitYear'))
          .all()
      ).filter((occurrence) => enrolledOccurrenceKeys.has(`${occurrence.id}:${occurrence.year}`))

      const candidateOccurrenceIds = [...new Set(loadedOccurrences.map((occurrence) => occurrence.id))]
      if (candidateOccurrenceIds.length === 0) return []

      const activePeriods = await db.orm.public.ExchangePeriod.where((period) =>
        period.occurrenceId.in(candidateOccurrenceIds),
      ).all()

      const withCourseUnits = loadedOccurrences.map((occurrence) => {
        if (!occurrence.courseUnit) throw new Error(`Course unit for occurrence ${occurrence.id} not found`)

        return {
          id: occurrence.id,
          courseUnitId: occurrence.courseUnitId,
          courseId: occurrence.courseId,
          year: occurrence.year,
          ects: occurrence.ects,
          url: occurrence.url,
          hash: occurrence.hash,
          acronym: occurrence.courseUnit.acronym,
          name: occurrence.courseUnit.name,
          courseUnitYear: occurrence.courseUnit.courseUnitYear,
        }
      })

      return selectEligible({ occurrences: withCourseUnits, periods: activePeriods, now: Date.now() })
    },
  }
}
