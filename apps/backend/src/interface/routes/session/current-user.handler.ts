import type { AuthUser } from '@/core/auth/user'
import { httpError } from '@/interface/errors/errors'
import { toSessionUser } from './session.presenter'

/**
 * Shared handler for `/auth/me` and `/users/me`: returns the current profile,
 * or a 401 when the request has no valid session.
 *
 * Keep this guard. `/users/me` is already covered by `createRequiredAuthMiddleware`,
 * so the check is unreachable there, but `/auth/me` cannot use a plugin-wide
 * guard: its plugin also serves the public login/callback/logout routes. The
 * check also narrows `user` for TypeScript.
 */
export function currentUserProfile({ user }: { user: AuthUser | null }) {
  if (!user) throw httpError.unauthorized()
  return toSessionUser(user)
}
