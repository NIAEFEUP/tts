import { describe, expect, it } from 'bun:test'
import { selectCourseWindows } from '@/infrastructure/database/repositories/prisma-exchange-periods.repository'

// Mimics Prisma 8 rows: DateTime fields are Temporal.Instant-like, with epochMilliseconds and no getTime.
const period = (id: string, occurrenceId: number, occurrenceYear: number, start: string, end: string) => ({
  id,
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
        period('a', 587177, 2024, '2024-09-01T00:00:00Z', '2024-09-15T00:00:00Z'), // same id, other year
        period('b', 587177, 2025, '2025-09-01T00:00:00Z', '2025-09-15T00:00:00Z'),
        period('c', 587179, 2025, '2025-09-01T00:00:00Z', '2025-09-15T00:00:00Z'), // repeated window
        period('d', 587177, 2025, '2026-02-01T00:00:00Z', '2026-02-15T00:00:00Z'),
      ],
    )

    expect(windows).toEqual([
      { id: 'b', startsAt: new Date('2025-09-01T00:00:00Z'), endsAt: new Date('2025-09-15T00:00:00Z') },
      { id: 'd', startsAt: new Date('2026-02-01T00:00:00Z'), endsAt: new Date('2026-02-15T00:00:00Z') },
    ])
  })

  it('returns the smallest id of a repeated window, whatever the row order', () => {
    const windows = selectCourseWindows(
      [{ id: 1, year: 2025 }],
      [
        period('z', 1, 2025, '2025-09-01T00:00:00Z', '2025-09-15T00:00:00Z'),
        period('a', 1, 2025, '2025-09-01T00:00:00Z', '2025-09-15T00:00:00Z'),
      ],
    )

    expect(windows).toEqual([
      { id: 'a', startsAt: new Date('2025-09-01T00:00:00Z'), endsAt: new Date('2025-09-15T00:00:00Z') },
    ])
  })

  it('returns an empty list when no period belongs to the course', () => {
    expect(
      selectCourseWindows(
        [{ id: 1, year: 2025 }],
        [period('a', 2, 2025, '2025-09-01T00:00:00Z', '2025-09-15T00:00:00Z')],
      ),
    ).toEqual([])
  })
})
