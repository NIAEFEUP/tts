import { isAdmin, type AuthUser } from '@/core/auth/user'

export type SessionUserProfile = {
  signed: true
  id: string
  name: string
  email: string | null
  isAdmin: boolean
  role: AuthUser['role']
}

/** Projects an authenticated user onto the public session response shape. */
export function toSessionUser(user: AuthUser): SessionUserProfile {
  return {
    signed: true,
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: isAdmin(user),
    role: user.role,
  }
}
