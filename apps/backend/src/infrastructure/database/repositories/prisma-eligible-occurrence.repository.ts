import type { EligibleOccurrenceRepository } from '@/domain/ports/eligible-occurrence.repository'
import type { Db } from '@/infrastructure/database/prisma'

export function createEligibleOccurrenceRepository({ db }: { db: Db }): EligibleOccurrenceRepository {
  return {
    async findByUserId(userId) {
      const enrollments = await db.orm.public.Enrollment.where({ userId })
        .orderBy((enrollment) => enrollment.classId.asc())
        .all()
      if (enrollments.length === 0) return []

      const classIds = [...new Set(enrollments.map((enrollment) => enrollment.classId))]
      const classes = await db.orm.public.Class.where((classRow) => classRow.id.in(classIds))
        .orderBy((classRow) => classRow.id.asc())
        .all()

      const occurrenceIds = [...new Set(classes.map((classRow) => classRow.occurrenceId))]

      const enrolledOccurrenceKeys = new Set(
        classes.map((classRow) => `${classRow.occurrenceId}:${classRow.occurrenceYear}`),
      )

      const enrolledOccurrences = await db.orm.public.Occurrence.where((occurrence) =>
        occurrence.id.in(occurrenceIds),
      ).all()

      const validEnrolled = enrolledOccurrences.filter((occurrence) =>
        enrolledOccurrenceKeys.has(`${occurrence.id}:${occurrence.year}`),
      )

      const courseUnitIds = [...new Set(validEnrolled.map((occurrence) => occurrence.courseUnitId))]
      if (courseUnitIds.length === 0) return []

      const loadedOccurrences = await db.orm.public.Occurrence.where((occurrence) =>
        occurrence.courseUnitId.in(courseUnitIds),
      )
        .include('courseUnit', (courseUnit) => courseUnit.select('acronym', 'name'))
        .all()

      const candidateOccurrenceIds = [...new Set(loadedOccurrences.map((occurrence) => occurrence.id))]
      const activePeriods = await db.orm.public.ExchangePeriod.where((period) =>
        period.occurrenceId.in(candidateOccurrenceIds),
      ).all()

      const withCourseUnits = loadedOccurrences
        .filter((occurrence) => occurrence.courseUnit !== null)
        .map((occurrence) => {
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
          }
        })

      const now = Date.now()
      const openOccurrenceKeys = new Set(
        activePeriods
          .filter((period) => period.startsAt.epochMilliseconds <= now && period.endsAt.epochMilliseconds >= now)
          .map((period) => `${period.occurrenceId}:${period.occurrenceYear}`),
      )

      return withCourseUnits
        .filter((occurrence) => openOccurrenceKeys.has(`${occurrence.id}:${occurrence.year}`))
        .sort((a, b) => b.year - a.year || a.id - b.id)
    },
  }
}
