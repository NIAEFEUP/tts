import { readEdenError } from '../errors'
import { client } from '../client'
import { enrollmentErrorToText } from '../../utils/error'

export type CreateEnrollmentRequestOption = {
  occurrenceId: number
  occurrenceYear: number
  enrolling: boolean
}

/**
 * Submits an enrollment/drop request through the Elysia API. The shared client
 * sends the session cookie, so no CSRF header or FormData is needed.
 */
const createRequest = async (options: CreateEnrollmentRequestOption[]) => {
  const { data, error } = await client.v1['enrollment-requests'].post({ options })

  if (error) {
    const body = readEdenError(error)
    throw new Error((body && enrollmentErrorToText[body.code]) ?? 'Erro ao submeter o pedido')
  }

  return data
}

const enrollmentService = {
  createRequest,
}

export default enrollmentService
