import type { ClassSlot } from './class.repository'

export type SlotClassReference = {
  id: number
  name: string
}

export type ScheduleSlotDetails = ClassSlot & {
  classes: SlotClassReference[]
}

export type SlotRepository = {
  findByOccurrence(occurrenceId: number, occurrenceYear: number): Promise<ScheduleSlotDetails[]>
  findById(id: number): Promise<ScheduleSlotDetails | null>
}
