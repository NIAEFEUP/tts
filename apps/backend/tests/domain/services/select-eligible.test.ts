import { describe, expect, it } from 'bun:test'

import { selectEligible, type ExchangePeriodLike } from '@/domain/services/select-eligible'

const NOW = Date.parse('2025-09-15T12:00:00Z')
const HOUR = 3_600_000

const instant = (offsetMs: number) => ({ epochMilliseconds: NOW + offsetMs })

const occurrence = (id: number, year: number) => ({ id, year })

const period = (occurrenceId: number, occurrenceYear: number, from: number, to: number): ExchangePeriodLike => ({
  occurrenceId,
  occurrenceYear,
  startsAt: instant(from),
  endsAt: instant(to),
})

const keys = (list: { id: number; year: number }[]) => list.map((o) => `${o.id}:${o.year}`)

describe('selectEligible', () => {
  it('includes an occurrence whose period is open now', () => {
    const result = selectEligible({
      occurrences: [occurrence(1, 2025)],
      periods: [period(1, 2025, -HOUR, HOUR)],
      now: NOW,
    })

    expect(keys(result)).toEqual(['1:2025'])
  })

  it('excludes a period that already closed', () => {
    const result = selectEligible({
      occurrences: [occurrence(1, 2025)],
      periods: [period(1, 2025, -2 * HOUR, -HOUR)],
      now: NOW,
    })

    expect(result).toEqual([])
  })

  it('excludes a period that has not opened yet', () => {
    const result = selectEligible({
      occurrences: [occurrence(1, 2025)],
      periods: [period(1, 2025, HOUR, 2 * HOUR)],
      now: NOW,
    })

    expect(result).toEqual([])
  })

  it('treats both the start and the end instant as open', () => {
    const result = selectEligible({
      occurrences: [occurrence(1, 2025), occurrence(2, 2025)],
      periods: [period(1, 2025, 0, HOUR), period(2, 2025, -HOUR, 0)],
      now: NOW,
    })

    expect(keys(result)).toEqual(['1:2025', '2:2025'])
  })

  it('closes one millisecond after the end', () => {
    const result = selectEligible({
      occurrences: [occurrence(1, 2025)],
      periods: [period(1, 2025, -HOUR, -1)],
      now: NOW,
    })

    expect(result).toEqual([])
  })

  it('does not match a period of the same id in another year', () => {
    const result = selectEligible({
      occurrences: [occurrence(1, 2025)],
      periods: [period(1, 2024, -HOUR, HOUR)],
      now: NOW,
    })

    expect(result).toEqual([])
  })

  it('keeps years apart when the same id appears twice', () => {
    const result = selectEligible({
      occurrences: [occurrence(1, 2024), occurrence(1, 2025)],
      periods: [period(1, 2025, -HOUR, HOUR)],
      now: NOW,
    })

    expect(keys(result)).toEqual(['1:2025'])
  })

  it('lists an occurrence once when it has two open periods', () => {
    const result = selectEligible({
      occurrences: [occurrence(1, 2025)],
      periods: [period(1, 2025, -2 * HOUR, HOUR), period(1, 2025, -HOUR, 2 * HOUR)],
      now: NOW,
    })

    expect(keys(result)).toEqual(['1:2025'])
  })

  it('is eligible if any one of several periods is open', () => {
    const result = selectEligible({
      occurrences: [occurrence(1, 2025)],
      periods: [period(1, 2025, -3 * HOUR, -2 * HOUR), period(1, 2025, -HOUR, HOUR)],
      now: NOW,
    })

    expect(keys(result)).toEqual(['1:2025'])
  })

  it('sorts by year descending, then by id ascending', () => {
    const occurrences = [occurrence(3, 2024), occurrence(2, 2025), occurrence(1, 2025), occurrence(4, 2023)]
    const periods = occurrences.map((o) => period(o.id, o.year, -HOUR, HOUR))

    expect(keys(selectEligible({ occurrences, periods, now: NOW }))).toEqual(['1:2025', '2:2025', '3:2024', '4:2023'])
  })

  it('returns an empty list without occurrences or without periods', () => {
    expect(selectEligible({ occurrences: [], periods: [], now: NOW })).toEqual([])
    expect(selectEligible({ occurrences: [occurrence(1, 2025)], periods: [], now: NOW })).toEqual([])
  })

  it('does not mutate its inputs', () => {
    const occurrences = [occurrence(2, 2025), occurrence(1, 2025)]
    const periods = occurrences.map((o) => period(o.id, o.year, -HOUR, HOUR))

    selectEligible({ occurrences, periods, now: NOW })

    expect(keys(occurrences)).toEqual(['2:2025', '1:2025'])
  })
})
