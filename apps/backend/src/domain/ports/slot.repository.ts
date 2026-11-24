import type { ClassProfessor, ClassSlot } from './class.repository'

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

  /**
   * Professors assigned to one slot, or `null` if the slot does not exist.
   * An existing slot with no professors returns an empty array.
   */
  findProfessors(slotId: number): Promise<ClassProfessor[] | null>
}
