import { client } from '../client'

export type CreateEnrollmentRequestOption = {
  occurrenceId: number
  occurrenceYear: number
  enrolling: boolean
}

const errorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'error' in error) return String(error.error)
  return 'Erro ao submeter o pedido'
}

/**
 * Submits an enrollment/drop request through the Elysia API.
 *
 * The shared client sends the session cookie (`credentials: 'include'`), so no
 * CSRF header or FormData is needed. Backend `{ error, code }` bodies are
 * turned into an `Error` whose message the submit handler can toast directly.
 */
const createRequest = async ({ options }: { options: CreateEnrollmentRequestOption[] }) => {
  const { data, error } = await client.v1['enrollment-requests'].post({ options })
  if (error) throw new Error(errorMessage(error))
  return data
}

const enrollmentService = {
  createRequest,
}

export default enrollmentService
