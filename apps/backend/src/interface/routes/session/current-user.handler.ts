import type { AuthUser } from '@/core/auth/user'
import { httpError } from '@/interface/errors/errors'
import { toSessionUser } from './session.presenter'

/**
 * Shared handler for `/auth/me` and `/users/me`: returns the current profile,
 * or a 401 when the request has no valid session.
 */
export function currentUserProfile({ user }: { user: AuthUser | null }) {
  if (!user) throw httpError.unauthorized()
  return toSessionUser(user)
}
