import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import type { Db } from '@/infrastructure/database/prisma'

export function createEnrollmentRepository({ db }: { db: Db }): EnrollmentRepository {
  return {
    async findByUserId(userId) {
      const enrollments = await db.orm.public.Enrollment.where({ userId })
        .orderBy((enrollment) => enrollment.classId.asc())
        .all()

      if (enrollments.length === 0) return []

      const loadOrEmpty = async <T>(ids: number[], load: () => PromiseLike<T[]>): Promise<T[]> =>
        ids.length === 0 ? [] : await load()

      const classIds = [...new Set(enrollments.map((enrollment) => enrollment.classId))]
      const [classes, classSlots] = await Promise.all([
        db.orm.public.Class.where((classRow) => classRow.id.in(classIds))
          .orderBy((classRow) => classRow.id.asc())
          .all(),
        db.orm.public.SlotClass.where((slotClass) => slotClass.classId.in(classIds)).all(),
      ])
      const occurrenceIds = [...new Set(classes.map((classRow) => classRow.occurrenceId))]
      const slotIds = [...new Set(classSlots.map((slotClass) => slotClass.slotId))]
      const [occurrences, slots, slotProfessors] = await Promise.all([
        loadOrEmpty(occurrenceIds, () =>
          db.orm.public.Occurrence.where((occurrence) => occurrence.id.in(occurrenceIds)).all(),
        ),
        loadOrEmpty(slotIds, () =>
          db.orm.public.ScheduleSlot.where((slot) => slot.id.in(slotIds))
            .orderBy((slot) => slot.id.asc())
            .all(),
        ),
        loadOrEmpty(slotIds, () =>
          db.orm.public.SlotProfessor.where((slotProfessor) => slotProfessor.slotId.in(slotIds)).all(),
        ),
      ])
      const courseUnitIds = [...new Set(occurrences.map((occurrence) => occurrence.courseUnitId))]
      const professorIds = [...new Set(slotProfessors.map((slotProfessor) => slotProfessor.professorId))]
      const [courseUnits, professors] = await Promise.all([
        loadOrEmpty(courseUnitIds, () =>
          db.orm.public.CourseUnit.where((courseUnit) => courseUnit.id.in(courseUnitIds)).all(),
        ),
        loadOrEmpty(professorIds, () =>
          db.orm.public.Professor.where((professor) => professor.id.in(professorIds))
            .orderBy((professor) => professor.id.asc())
            .all(),
        ),
      ])

      const classesById = new Map(classes.map((classRow) => [classRow.id, classRow] as const))
      const occurrencesByKey = new Map(
        occurrences.map((occurrence) => [`${occurrence.id}:${occurrence.year}`, occurrence] as const),
      )
      const courseUnitsById = new Map(courseUnits.map((courseUnit) => [courseUnit.id, courseUnit] as const))
      const slotsById = new Map(slots.map((slot) => [slot.id, slot] as const))
      const professorsById = new Map(professors.map((professor) => [professor.id, professor] as const))

      const slotProfessorsBySlotId = new Map<number, typeof professors>()
      for (const slotProfessor of slotProfessors) {
        const professor = professorsById.get(slotProfessor.professorId)
        if (!professor) throw new Error(`Professor ${slotProfessor.professorId} not found`)

        const assigned = slotProfessorsBySlotId.get(slotProfessor.slotId)
        if (assigned) assigned.push(professor)
        else slotProfessorsBySlotId.set(slotProfessor.slotId, [professor])
      }

      const classSlotsByClassId = new Map<number, number[]>()
      for (const classSlot of classSlots) {
        const assigned = classSlotsByClassId.get(classSlot.classId)
        if (assigned) assigned.push(classSlot.slotId)
        else classSlotsByClassId.set(classSlot.classId, [classSlot.slotId])
      }
      for (const slotIds of classSlotsByClassId.values()) slotIds.sort((a, b) => a - b)

      return enrollments.map((enrollment) => {
        const classRow = classesById.get(enrollment.classId)
        if (!classRow) throw new Error(`Class ${enrollment.classId} not found`)

        const occurrence = occurrencesByKey.get(`${classRow.occurrenceId}:${classRow.occurrenceYear}`)
        if (!occurrence) {
          throw new Error(`Occurrence ${classRow.occurrenceId}:${classRow.occurrenceYear} not found`)
        }

        const courseUnit = courseUnitsById.get(occurrence.courseUnitId)
        if (!courseUnit) throw new Error(`Course unit ${occurrence.courseUnitId} not found`)

        return {
          occurrence: {
            id: occurrence.id,
            year: occurrence.year,
            courseUnit: {
              id: courseUnit.id,
              acronym: courseUnit.acronym,
              name: courseUnit.name,
              semester: courseUnit.semester,
            },
          },
          class: {
            id: classRow.id,
            name: classRow.name,
            vacancies: classRow.vacancies,
            slots: (classSlotsByClassId.get(classRow.id) ?? []).map((slotId) => {
              const slot = slotsById.get(slotId)
              if (!slot) throw new Error(`Schedule slot ${slotId} not found`)

              return {
                id: slot.id,
                lessonType: slot.lessonType,
                dayOfWeek: slot.dayOfWeek,
                startMinute: slot.startMinute,
                durationMin: slot.durationMin,
                location: slot.location,
                professors: (slotProfessorsBySlotId.get(slot.id) ?? []).map((professor) => ({
                  id: professor.id,
                  acronym: professor.acronym,
                  name: professor.name,
                })),
              }
            }),
          },
        }
      })
    },
  }
}
