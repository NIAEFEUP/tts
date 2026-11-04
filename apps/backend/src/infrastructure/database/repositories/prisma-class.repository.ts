import type { Class, ClassRepository, ClassWithSlots } from '@/domain/ports/class.repository'
import type { Db } from '@/infrastructure/database/prisma'

import { and } from '@prisma/orm-postgres/orm-client'

export function createClassRepository({ db }: { db: Db }): ClassRepository {
  async function loadWithSlots(classes: Class[]): Promise<ClassWithSlots[]> {
    if (classes.length === 0) return []

    const classIds = classes.map((classRow) => classRow.id)
    const classSlots = await db.orm.public.SlotClass.where((link) => link.classId.in(classIds)).all()
    const slotIds = [...new Set(classSlots.map((link) => link.slotId))]

    const [slots, slotProfessorLinks] = await Promise.all([
      slotIds.length === 0
        ? []
        : db.orm.public.ScheduleSlot.where((slot) => slot.id.in(slotIds))
            .orderBy((slot) => slot.id.asc())
            .all(),
      slotIds.length === 0 ? [] : db.orm.public.SlotProfessor.where((link) => link.slotId.in(slotIds)).all(),
    ])

    const professorIds = [...new Set(slotProfessorLinks.map((link) => link.professorId))]
    const professors =
      professorIds.length === 0
        ? []
        : await db.orm.public.Professor.where((professor) => professor.id.in(professorIds))
            .orderBy((professor) => professor.id.asc())
            .all()

    const professorsById = new Map(professors.map((professor) => [professor.id, professor] as const))
    const professorsBySlotId = new Map<number, ClassWithSlots['slots'][number]['professors']>()

    for (const link of slotProfessorLinks) {
      const professor = professorsById.get(link.professorId)
      if (!professor) throw new Error(`Professor ${link.professorId} not found`)

      const assigned = professorsBySlotId.get(link.slotId)
      const value = { id: professor.id, acronym: professor.acronym, name: professor.name }

      if (assigned) assigned.push(value)
      else professorsBySlotId.set(link.slotId, [value])
    }

    const slotIdsByClassId = new Map<number, number[]>()
    for (const link of classSlots) {
      const assigned = slotIdsByClassId.get(link.classId)
      if (assigned) assigned.push(link.slotId)
      else slotIdsByClassId.set(link.classId, [link.slotId])
    }

    for (const ids of slotIdsByClassId.values()) ids.sort((a, b) => a - b)

    const slotsById = new Map(slots.map((slot) => [slot.id, slot] as const))

    return classes.map((classRow) => ({
      ...classRow,
      slots: (slotIdsByClassId.get(classRow.id) ?? []).map((slotId) => {
        const slot = slotsById.get(slotId)
        if (!slot) throw new Error(`Schedule slot ${slotId} not found`)

        return {
          id: slot.id,
          lessonType: slot.lessonType,
          dayOfWeek: slot.dayOfWeek,
          startMinute: slot.startMinute,
          durationMin: slot.durationMin,
          location: slot.location,
          professors: professorsBySlotId.get(slot.id) ?? [],
        }
      }),
    }))
  }

  return {
    // GET /v1/classes/:id — one class, with its slots and professors
    async findById(id): Promise<ClassWithSlots | null> {
      const classRow = await db.orm.public.Class.where((row) => row.id.eq(id))
        .select('id', 'occurrenceId', 'occurrenceYear', 'name', 'vacancies', 'createdAt', 'updatedAt')
        .first()

      if (!classRow) return null

      const [classWithSlots] = await loadWithSlots([classRow])
      if (!classWithSlots) throw new Error(`Class ${id} could not be assembled`)

      return classWithSlots
    },

    // GET /v1/occurrences/:id/classes — classes for the exact occurrence, each with their slots and professors
    async findByOccurrence(occurrenceId, occurrenceYear): Promise<ClassWithSlots[]> {
      const classes = await db.orm.public.Class.where((row) =>
        and(row.occurrenceId.eq(occurrenceId), row.occurrenceYear.eq(occurrenceYear)),
      )
        .select('id', 'occurrenceId', 'occurrenceYear', 'name', 'vacancies', 'createdAt', 'updatedAt')
        .orderBy((row) => row.id.asc())
        .all()

      return loadWithSlots(classes)
    },
  }
}
