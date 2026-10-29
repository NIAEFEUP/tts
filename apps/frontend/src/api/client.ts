import { treaty, type Treaty } from '@elysiajs/eden'
import type { App } from 'tts-be'
import { ENV } from 'varlock/env'

// Same resolution as `api/backend.ts`: `VITE_APP_BACKEND_URL` when set, the local
// Elysia server in dev, and the page origin plus the platform's `/api` mount in a
// prod/staging build.
const backendUrl =
  ENV.VITE_APP_BACKEND_URL || (ENV.VITE_APP_PROD ? `${window.location.origin}/api` : 'http://localhost:3000')

// `credentials: 'include'`: in dev the frontend (:3100) and backend (:3000) are
// cross-origin, and fetch defaults to `credentials: 'same-origin'`, which would
// drop the session cookie and turn every catalog call into a 401.
export const client: Treaty.Create<App> = treaty<App>(backendUrl, {
  fetch: { credentials: 'include' },
})
