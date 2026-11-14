import type { ClassProfessor } from './class.repository'

export type SlotClassReference = {
  id: number
  name: string
}

export type ScheduleSlotDetails = {
  id: number
  lessonType: string
  dayOfWeek: number
  startMinute: number
  durationMin: number
  location: string | null
  classes: SlotClassReference[]
  professors: ClassProfessor[]
}

export type SlotRepository = {
  findByOccurrence(occurrenceId: number, occurrenceYear: number): Promise<ScheduleSlotDetails[]>

  findById(id: number): Promise<ScheduleSlotDetails | null>
}
