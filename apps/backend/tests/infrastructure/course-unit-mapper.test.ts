import { describe, expect, it } from 'bun:test'

import { toCourseUnitSemester, toCourseUnitYear } from '@/infrastructure/database/repositories/course-unit-mapper'

describe('course-unit mappers', () => {
  it('narrows the two valid semesters', () => {
    expect(toCourseUnitSemester(1)).toBe(1)
    expect(toCourseUnitSemester(2)).toBe(2)
  })

  it('rejects a semester outside 1..2', () => {
    for (const value of [0, 3, -1]) {
      expect(() => toCourseUnitSemester(value)).toThrow(`CourseUnit row has an invalid semester: ${value}`)
    }
  })

  it('accepts every curricular year in 1..6', () => {
    for (const year of [1, 2, 3, 4, 5, 6] as const) {
      expect(toCourseUnitYear(year)).toBe(year)
    }
  })

  it('rejects the db:update placeholder and out-of-range years', () => {
    // `db:update` can leave the column at 0; a bad row must fail at the
    // repository instead of being served as a curricular year.
    for (const value of [0, 7, -1, 1.5]) {
      expect(() => toCourseUnitYear(value)).toThrow(`CourseUnit row has an invalid courseUnitYear: ${value}`)
    }
  })
})
