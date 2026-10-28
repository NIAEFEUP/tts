import { Elysia } from 'elysia'
import type { AuthUser } from '@/core/auth/user'
import { httpError } from '@/interface/errors/errors'
import { SESSION_COOKIE } from '@/interface/routes/auth/auth.utils'

export type SessionResolver = (token: string) => Promise<AuthUser | null>

/**
 * Reads the session cookie, resolves it to a user, and exposes `user` /
 * `sessionToken` on the context. Used as a plugin by route groups that need to
 * know who is calling; the lifecycle is local to the instance it is `use`d on.
 */
export function createAuthMiddleware({ resolveSession }: { resolveSession: SessionResolver }) {
  return new Elysia({ name: 'auth/session' }).derive({ as: 'global' }, async ({ cookie }) => {
    const raw = cookie[SESSION_COOKIE]?.value
    const sessionToken = typeof raw === 'string' && raw.length > 0 ? raw : null
    const user = sessionToken ? await resolveSession(sessionToken) : null
    return { user, sessionToken }
  })
}

/**
 * Same as `createAuthMiddleware`, but every route on the instance that mounts it
 * requires a valid session: anonymous callers get a 401 before the handler runs.
 * A protected route group mounts this instead of re-checking `user` by hand.
 */
export function createRequiredAuthMiddleware({ resolveSession }: { resolveSession: SessionResolver }) {
  // A distinct plugin name keeps this out of the deduplicated `auth/session`
  // plugin, and `scoped` lifts the guard to the instance that mounts it (the
  // protected route group) without leaking to its own parent.
  return new Elysia({ name: 'auth/required' })
    .use(createAuthMiddleware({ resolveSession }))
    .onBeforeHandle({ as: 'scoped' }, ({ user }) => {
      if (!user) throw httpError.unauthorized()
    })
}
