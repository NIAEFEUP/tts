import { and } from '@prisma/orm-postgres/orm-client'

import type { ClassProfessor } from '@/domain/ports/class.repository'
import type { ScheduleSlotDetails, SlotClassReference, SlotRepository } from '@/domain/ports/slot.repository'
import type { Db } from '@/infrastructure/database/prisma'

type ClassRow = SlotClassReference & {
  occurrenceId: number
  occurrenceYear: number
}

async function loadSlotDetails(db: Db, classRows: ClassRow[]): Promise<ScheduleSlotDetails[]> {
  if (classRows.length === 0) return []

  const classIds = classRows.map((classRow) => classRow.id)
  const assignments = await db.orm.public.SlotClass.where((slotClass) => slotClass.classId.in(classIds)).all()
  const slotIds = [...new Set(assignments.map((assignment) => assignment.slotId))].sort((a, b) => a - b)
  if (slotIds.length === 0) return []

  const [slots, professorAssignments] = await Promise.all([
    db.orm.public.ScheduleSlot.where((slot) => slot.id.in(slotIds))
      .orderBy((slot) => slot.id.asc())
      .all(),
    db.orm.public.SlotProfessor.where((assignment) => assignment.slotId.in(slotIds)).all(),
  ])
  const professorIds = [...new Set(professorAssignments.map((assignment) => assignment.professorId))]
  const professors =
    professorIds.length === 0
      ? []
      : await db.orm.public.Professor.where((professor) => professor.id.in(professorIds))
          .orderBy((professor) => professor.id.asc())
          .all()

  const classesById = new Map(classRows.map((classRow) => [classRow.id, classRow] as const))
  const professorsById = new Map<number, ClassProfessor>(
    professors.map(
      (professor) => [professor.id, { id: professor.id, acronym: professor.acronym, name: professor.name }] as const,
    ),
  )
  const classesBySlotId = new Map<number, SlotClassReference[]>()
  const professorsBySlotId = new Map<number, ClassProfessor[]>()

  for (const assignment of assignments) {
    const classRow = classesById.get(assignment.classId)
    if (!classRow) throw new Error(`Class ${assignment.classId} not found`)

    const assigned = classesBySlotId.get(assignment.slotId)
    const classReference = { id: classRow.id, name: classRow.name }
    if (assigned) assigned.push(classReference)
    else classesBySlotId.set(assignment.slotId, [classReference])
  }

  for (const assignment of professorAssignments) {
    const professor = professorsById.get(assignment.professorId)
    if (!professor) throw new Error(`Professor ${assignment.professorId} not found`)

    const assigned = professorsBySlotId.get(assignment.slotId)
    if (assigned) assigned.push(professor)
    else professorsBySlotId.set(assignment.slotId, [professor])
  }

  const slotsById = new Map(slots.map((slot) => [slot.id, slot] as const))
  return slotIds.map((slotId) => {
    const slot = slotsById.get(slotId)
    if (!slot) throw new Error(`Schedule slot ${slotId} not found`)

    return {
      id: slot.id,
      lessonType: slot.lessonType,
      dayOfWeek: slot.dayOfWeek,
      startMinute: slot.startMinute,
      durationMin: slot.durationMin,
      location: slot.location,
      classes: (classesBySlotId.get(slot.id) ?? []).sort((a, b) => a.id - b.id),
      professors: (professorsBySlotId.get(slot.id) ?? []).sort((a, b) => a.id - b.id),
    }
  })
}

export function createSlotRepository({ db }: { db: Db }): SlotRepository {
  return {
    async findByOccurrence(occurrenceId, occurrenceYear) {
      const classRows = await db.orm.public.Class.where((classRow) =>
        and(classRow.occurrenceId.eq(occurrenceId), classRow.occurrenceYear.eq(occurrenceYear)),
      )
        .select('id', 'name', 'occurrenceId', 'occurrenceYear')
        .orderBy((classRow) => classRow.id.asc())
        .all()

      return loadSlotDetails(db, classRows)
    },

    async findById(id) {
      const assignments = await db.orm.public.SlotClass.where((slotClass) => slotClass.slotId.eq(id)).all()
      if (assignments.length === 0) {
        const slot = await db.orm.public.ScheduleSlot.where((row) => row.id.eq(id)).first()
        if (!slot) return null

        return {
          id: slot.id,
          lessonType: slot.lessonType,
          dayOfWeek: slot.dayOfWeek,
          startMinute: slot.startMinute,
          durationMin: slot.durationMin,
          location: slot.location,
          classes: [],
          professors: await loadProfessors(db, id),
        }
      }

      const classIds = [...new Set(assignments.map((assignment) => assignment.classId))]
      const classRows = await db.orm.public.Class.where((classRow) => classRow.id.in(classIds))
        .select('id', 'name', 'occurrenceId', 'occurrenceYear')
        .orderBy((classRow) => classRow.id.asc())
        .all()
      const details = await loadSlotDetails(db, classRows)
      return details.find((slot) => slot.id === id) ?? null
    },
  }
}

async function loadProfessors(db: Db, slotId: number): Promise<ClassProfessor[]> {
  const assignments = await db.orm.public.SlotProfessor.where((assignment) => assignment.slotId.eq(slotId)).all()
  const professorIds = [...new Set(assignments.map((assignment) => assignment.professorId))]
  if (professorIds.length === 0) return []

  const professors = await db.orm.public.Professor.where((professor) => professor.id.in(professorIds))
    .orderBy((professor) => professor.id.asc())
    .all()
  const professorsById = new Map(professors.map((professor) => [professor.id, professor] as const))

  return assignments
    .map((assignment) => {
      const professor = professorsById.get(assignment.professorId)
      if (!professor) throw new Error(`Professor ${assignment.professorId} not found`)

      return { id: professor.id, acronym: professor.acronym, name: professor.name }
    })
    .sort((a, b) => a.id - b.id)
}
