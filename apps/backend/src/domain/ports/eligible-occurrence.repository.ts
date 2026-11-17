import type { OccurrenceWithUnit } from './occurrence.repository'

export type EligibleOccurrenceRepository = {
  findByUserId(userId: string): Promise<OccurrenceWithUnit[]>
}
