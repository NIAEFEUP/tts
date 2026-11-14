import { describe, expect, it } from 'bun:test'
import { selectCourseWindows } from '@/infrastructure/database/repositories/prisma-exchange-periods.repository'

// Mimics Prisma 8 rows: DateTime fields are Temporal.Instant-like, with epochMilliseconds and no getTime.
const period = (occurrenceId: number, occurrenceYear: number, start: string, end: string) => ({
  occurrenceId,
  occurrenceYear,
  startsAt: { epochMilliseconds: Date.parse(start) },
  endsAt: { epochMilliseconds: Date.parse(end) },
})

describe('selectCourseWindows', () => {
  it('keeps only the course (id, year) pairs and drops repeated windows', () => {
    const windows = selectCourseWindows(
      [
        { id: 587177, year: 2025 },
        { id: 587179, year: 2025 },
      ],
      [
        period(587177, 2024, '2024-09-01T00:00:00Z', '2024-09-15T00:00:00Z'), // same id, other year
        period(587177, 2025, '2025-09-01T00:00:00Z', '2025-09-15T00:00:00Z'),
        period(587179, 2025, '2025-09-01T00:00:00Z', '2025-09-15T00:00:00Z'), // repeated window
        period(587177, 2025, '2026-02-01T00:00:00Z', '2026-02-15T00:00:00Z'),
      ],
    )

    expect(windows).toEqual([
      { startsAt: new Date('2025-09-01T00:00:00Z'), endsAt: new Date('2025-09-15T00:00:00Z') },
      { startsAt: new Date('2026-02-01T00:00:00Z'), endsAt: new Date('2026-02-15T00:00:00Z') },
    ])
  })

  it('returns an empty list when no period belongs to the course', () => {
    expect(
      selectCourseWindows([{ id: 1, year: 2025 }], [period(2, 2025, '2025-09-01T00:00:00Z', '2025-09-15T00:00:00Z')]),
    ).toEqual([])
  })
})
