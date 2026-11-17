import type { ClassSlot } from './class.repository'

export type SlotClassReference = {
  id: number
  name: string
}

export type ScheduleSlotDetails = ClassSlot & {
  classes: SlotClassReference[]
}
