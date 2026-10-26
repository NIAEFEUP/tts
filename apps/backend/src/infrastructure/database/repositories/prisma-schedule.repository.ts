import type { ScheduleRepository } from '@/domain/ports/schedule.repository'
import type { Db } from '@/infrastructure/database/prisma'

/**
 * Prisma implementation of `ScheduleRepository`. A student's schedule is the
 * lessons of the classes they hold an `Enrollment` for; a lesson shared by
 * several classes (`SlotClass`) shows up once per enrolled class.
 *
 * Every relation below is a required foreign key, but the generated types model
 * a to-one include as nullable, so the `?.` / `flatMap` guards only narrow.
 */
export function createScheduleRepository({ db }: { db: Db }): ScheduleRepository {
  return {
    async findByStudent(nmec) {
      const enrollments = await db.orm.public.Enrollment.where({ userId: nmec })
        .include('class', (cls) =>
          cls
            .include('occurrence', (occurrence) => occurrence.include('courseUnit'))
            .include('slotClasses', (link) => link.include('slot')),
        )
        .all()

      return enrollments
        .flatMap(({ class: cls }) =>
          cls?.occurrence?.courseUnit ? [{ cls, courseUnit: cls.occurrence.courseUnit }] : [],
        )
        .map(({ cls, courseUnit }) => ({
          classId: cls.id,
          className: cls.name,
          occurrenceId: cls.occurrenceId,
          occurrenceYear: cls.occurrenceYear,
          courseUnit: { acronym: courseUnit.acronym, name: courseUnit.name },
          slots: cls.slotClasses
            .flatMap(({ slot }) => (slot ? [slot] : []))
            .map((slot) => ({
              id: slot.id,
              lessonType: slot.lessonType,
              dayOfWeek: slot.dayOfWeek,
              startMinute: slot.startMinute,
              durationMin: slot.durationMin,
              location: slot.location,
            }))
            .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute),
        }))
        .sort(
          (a, b) => a.courseUnit.acronym.localeCompare(b.courseUnit.acronym) || a.className.localeCompare(b.className),
        )
    },

    async sharesCourse(nmecA, nmecB) {
      const [coursesA, coursesB] = await Promise.all([courseIdsOf(db, nmecA), courseIdsOf(db, nmecB)])
      for (const courseId of coursesA) if (coursesB.has(courseId)) return true

      return false
    },
  }
}

/** The ids of every `Course` the student has an enrolled class in. */
async function courseIdsOf(db: Db, nmec: string): Promise<Set<number>> {
  const enrollments = await db.orm.public.Enrollment.where({ userId: nmec })
    .include('class', (cls) => cls.include('occurrence'))
    .all()

  return new Set(enrollments.flatMap(({ class: cls }) => (cls?.occurrence ? [cls.occurrence.courseId] : [])))
}
