import type { AuthUser } from '@/core/auth/user'
import { httpError } from '@/interface/errors/errors'
import { toSessionUser } from './session.presenter'

export function currentUserProfile({ user }: { user: AuthUser | null }) {
  if (!user) throw httpError.unauthorized()
  return toSessionUser(user)
}
