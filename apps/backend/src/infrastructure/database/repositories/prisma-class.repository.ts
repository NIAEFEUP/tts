import { and } from '@prisma/orm-postgres/orm-client'

import type { ClassRepository, ClassWithSlots, EnrolledStudent } from '@/domain/ports/class.repository'
import type { Db } from '@/infrastructure/database/prisma'

type ClassRow = Pick<ClassWithSlots, 'id' | 'occurrenceId' | 'occurrenceYear' | 'name' | 'vacancies'>

async function loadClassDetails(db: Db, classes: ClassRow[]): Promise<ClassWithSlots[]> {
  if (classes.length === 0) return []

  const classIds = classes.map((classRow) => classRow.id)
  const classSlots = await db.orm.public.SlotClass.where((slotClass) => slotClass.classId.in(classIds)).all()
  const slotIds = [...new Set(classSlots.map((slotClass) => slotClass.slotId))]

  const [slots, slotProfessors] = await Promise.all([
    slotIds.length === 0
      ? []
      : db.orm.public.ScheduleSlot.where((slot) => slot.id.in(slotIds))
          .orderBy((slot) => slot.id.asc())
          .all(),
    slotIds.length === 0
      ? []
      : db.orm.public.SlotProfessor.where((slotProfessor) => slotProfessor.slotId.in(slotIds)).all(),
  ])

  const professorIds = [...new Set(slotProfessors.map((slotProfessor) => slotProfessor.professorId))]
  const professors =
    professorIds.length === 0
      ? []
      : await db.orm.public.Professor.where((professor) => professor.id.in(professorIds))
          .orderBy((professor) => professor.id.asc())
          .all()

  const slotsById = new Map(slots.map((slot) => [slot.id, slot] as const))
  const professorsById = new Map(professors.map((professor) => [professor.id, professor] as const))
  const slotProfessorsBySlotId = new Map<number, typeof professors>()

  for (const assignment of slotProfessors) {
    const professor = professorsById.get(assignment.professorId)
    if (!professor) throw new Error(`Professor ${assignment.professorId} not found`)

    const assigned = slotProfessorsBySlotId.get(assignment.slotId)
    if (assigned) assigned.push(professor)
    else slotProfessorsBySlotId.set(assignment.slotId, [professor])
  }

  const slotIdsByClassId = new Map<number, number[]>()
  for (const assignment of classSlots) {
    const assigned = slotIdsByClassId.get(assignment.classId)
    if (assigned) assigned.push(assignment.slotId)
    else slotIdsByClassId.set(assignment.classId, [assignment.slotId])
  }
  for (const assignedSlotIds of slotIdsByClassId.values()) assignedSlotIds.sort((a, b) => a - b)

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
        professors: (slotProfessorsBySlotId.get(slot.id) ?? []).map((professor) => ({
          id: professor.id,
          acronym: professor.acronym,
          name: professor.name,
        })),
      }
    }),
  }))
}

export function createClassRepository({ db }: { db: Db }): ClassRepository {
  return {
    // GET /v1/classes/:id — one class, with its slots and professors
    async findById(id): Promise<ClassWithSlots | null> {
      const classRow = await db.orm.public.Class.where((row) => row.id.eq(id))
        .select('id', 'occurrenceId', 'occurrenceYear', 'name', 'vacancies')
        .first()

      if (!classRow) return null

      const [details] = await loadClassDetails(db, [classRow])
      if (!details) throw new Error(`Class ${id} could not be assembled`)

      return details
    },

    // GET /v1/occurrences/:id/classes — classes for the exact occurrence, each with their slots and professors
    async findByOccurrence(occurrenceId, occurrenceYear): Promise<ClassWithSlots[]> {
      const classes = await db.orm.public.Class.where((classRow) =>
        and(classRow.occurrenceId.eq(occurrenceId), classRow.occurrenceYear.eq(occurrenceYear)),
      )
        .select('id', 'occurrenceId', 'occurrenceYear', 'name', 'vacancies')
        .orderBy((classRow) => classRow.id.asc())
        .all()

      return loadClassDetails(db, classes)
    },

    // GET /v1/classes/:id/students — enrolled students for an existing class.
    async findStudentsByClassId(classId): Promise<EnrolledStudent[] | null> {
      const classRow = await db.orm.public.Class.where((row) => row.id.eq(classId))
        .select('id')
        .first()
      if (!classRow) return null

      const enrollments = await db.orm.public.Enrollment.where((enrollment) => enrollment.classId.eq(classId))
        .select('userId')
        .orderBy((enrollment) => enrollment.userId.asc())
        .all()
      if (enrollments.length === 0) return []

      const userIds = [...new Set(enrollments.map((enrollment) => enrollment.userId))]
      const users = await db.orm.public.User.where((user) => user.id.in(userIds))
        .orderBy((user) => user.id.asc())
        .select('id', 'name')
        .all()
      const usersById = new Map(users.map((user) => [user.id, user] as const))

      return enrollments.map((enrollment) => {
        const user = usersById.get(enrollment.userId)
        if (!user) throw new Error(`User ${enrollment.userId} not found`)

        return { id: user.id, name: user.name }
      })
    },
  }
}
