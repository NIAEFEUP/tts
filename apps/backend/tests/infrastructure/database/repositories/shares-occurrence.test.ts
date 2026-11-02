import { describe, expect, it } from 'bun:test'

import { hasCommonOccurrence } from '@/infrastructure/database/repositories/shares-occurrence'

const occ = (occurrenceId: number, occurrenceYear: number) => ({ occurrenceId, occurrenceYear })

describe('hasCommonOccurrence', () => {
  it('is true when both sides have the same id and year', () => {
    expect(hasCommonOccurrence([occ(100, 2025), occ(200, 2025)], [occ(300, 2025), occ(200, 2025)])).toBe(true)
  })

  it('is true when one occurrence is repeated on a side (a T and a TP class)', () => {
    expect(hasCommonOccurrence([occ(100, 2025), occ(100, 2025)], [occ(100, 2025)])).toBe(true)
  })

  it('is false when the same id appears in different years', () => {
    expect(hasCommonOccurrence([occ(100, 2025)], [occ(100, 2024)])).toBe(false)
  })

  it('is false when the same year appears with different ids', () => {
    expect(hasCommonOccurrence([occ(100, 2025)], [occ(101, 2025)])).toBe(false)
  })

  it('is false when either side is empty', () => {
    expect(hasCommonOccurrence([], [occ(100, 2025)])).toBe(false)
    expect(hasCommonOccurrence([occ(100, 2025)], [])).toBe(false)
    expect(hasCommonOccurrence([], [])).toBe(false)
  })
})
