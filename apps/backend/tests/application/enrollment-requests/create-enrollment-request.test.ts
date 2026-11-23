import { describe, expect, it } from 'bun:test'

import { createCreateEnrollmentRequest } from '@/application/use-cases/enrollment-requests/create-enrollment-request'
import type { EnrollmentRepository } from '@/domain/ports/enrollment.repository'
import type { EnrollmentRequestRepository } from '@/domain/ports/enrollment-request.repository'
import type { ExchangePeriodsRepository } from '@/domain/ports/exchange-period.repository'
import type { OccurrenceRepository, OccurrenceWithUnit } from '@/domain/ports/occurrence.repository'

const USER_ID = 'up202012345'
const OCCURRENCE: OccurrenceWithUnit = {
  id: 587177,
  courseUnitId: 42,
  courseId: 22841,
  year: 2025,
  ects: 6,
  url: 'https://sigarra.up.pt/feup/pt/ucurr_geral.ficha_uc_view?pv_ocorrencia_id=587177',
  hash: 'hash-bd-2025',
  acronym: 'BD',
  name: 'Bases de Dados',
  courseUnitYear: 2,
}

const enrollments: EnrollmentRepository = {
  findByUserId: async () => [],
  sharesOccurrence: async () => false,
  isEnrolledInOccurrence: async () => false,
}

const occurrences: OccurrenceRepository = {
  findByCourseUnit: async () => [],
  findByCourse: async () => [],
  findById: async () => OCCURRENCE,
}

const periods: ExchangePeriodsRepository = {
  findByOccurrence: async () => [
    {
      id: 'period-1',
      occurrenceId: OCCURRENCE.id,
      occurrenceYear: OCCURRENCE.year,
      startsAt: new Date('2000-01-01T00:00:00.000Z'),
      endsAt: new Date('2100-01-01T00:00:00.000Z'),
    },
  ],
  findByCourse: async () => [],
}

describe('create enrollment request use case', () => {
  it('rejects an empty options array without touching any repository', async () => {
    const fail = async () => {
      throw new Error('repository should not be called')
    }

    const createEnrollmentRequest = createCreateEnrollmentRequest({
      enrollmentRequests: {
        findByUserId: fail,
        findById: fail,
        create: fail,
        withdraw: fail,
      },
      enrollments: { findByUserId: fail, sharesOccurrence: fail, isEnrolledInOccurrence: fail },
      occurrences: { findByCourseUnit: fail, findByCourse: fail, findById: fail },
      periods: { findByOccurrence: fail, findByCourse: fail },
    })

    const result = await createEnrollmentRequest(USER_ID, [])

    expect(result).toEqual({ kind: 'empty-options' })
  })

  it('maps a duplicate found by the repository write to duplicate-request', async () => {
    const enrollmentRequests: EnrollmentRequestRepository = {
      findByUserId: async () => [],
      findById: async () => null,
      // Simulates a concurrent submission that committed between the
      // pre-write validations and the transaction's duplicate check.
      create: async () => ({ kind: 'duplicate', occurrenceId: OCCURRENCE.id, occurrenceYear: OCCURRENCE.year }),
      withdraw: async () => false,
    }

    const createEnrollmentRequest = createCreateEnrollmentRequest({
      enrollmentRequests,
      enrollments,
      occurrences,
      periods,
    })

    const result = await createEnrollmentRequest(USER_ID, [
      { occurrenceId: OCCURRENCE.id, occurrenceYear: OCCURRENCE.year, enrolling: false },
    ])

    expect(result).toEqual({
      kind: 'duplicate-request',
      occurrenceId: OCCURRENCE.id,
      occurrenceYear: OCCURRENCE.year,
    })
  })
})
