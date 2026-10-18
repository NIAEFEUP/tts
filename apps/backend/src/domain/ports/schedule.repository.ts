// Read-side port for a student's schedule. The Prisma implementation lives
// in `infrastructure/database/repositories/`.

export type ScheduleSlot = {
  id: number

  /** "T" | "TP" | "P" | "PL" | "OT" | "O" | "E" */
  lessonType: string
  /** 0 = Sunday. */
  dayOfWeek: number

  /** Minutes since midnight, e.g. 60 = 01:00, 540 = 09:00...  */
  startMinute: number
  durationMin: number

  location: string | null
}

// One class the student is enrolled in, with its course unit and lessons.
export type ScheduleEntry = {
  classId: number
  className: string

  occurrence: {
    id: number
    year: number
    courseUnit: { acronym: string; name: string }
  }

  slots: ScheduleSlot[]
}

export type ScheduleRepository = {
  findByUserId(userId: string): Promise<ScheduleEntry[]>
}
