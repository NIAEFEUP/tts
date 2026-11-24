/** The `{ error, code }` body every API failure returns. */
export type ApiErrorBody = {
  error: string
  code: string
}

/**
 * Reads the body of an Eden treaty2 error. HTTP failures resolve as an
 * `EdenFetchError` with `status` and `value`, where `value` is the parsed body.
 * Missing or malformed bodies return `null` so callers can use their own
 * fallback.
 */
export const readEdenError = (error: unknown): ApiErrorBody | null => {
  if (typeof error !== 'object' || error === null || !('value' in error)) return null

  const value = (error as { value?: unknown }).value
  if (typeof value !== 'object' || value === null) return null

  const body = value as { error?: unknown; code?: unknown }
  if (typeof body.error !== 'string' || typeof body.code !== 'string') return null

  return { error: body.error, code: body.code }
}

/** Shared fallback for callers that only need a readable message. */
export const edenErrorMessage = (error: unknown, fallback: string): string => readEdenError(error)?.error ?? fallback
