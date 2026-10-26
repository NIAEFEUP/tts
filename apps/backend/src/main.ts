import { node } from '@elysiajs/node'
import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { pathToFileURL } from 'node:url'
import { errorHandler } from '@/interface/middleware/error-handler'
import { loadAuthConfig } from '@/core/config/auth'
import { openapiPlugin } from '@/interface/plugins/openapi'
import { createApiRoutes } from '@/interface/routes/api.routes'
import { createRepositories } from '@/infrastructure/database/repositories'
import { db } from '@/infrastructure/database/prisma'
import { createSigarraOidcProvider } from '@/infrastructure/external/sigarra-oidc.provider'
import { createSigarraDirectAuth } from '@/infrastructure/external/sigarra-direct-auth'
import { createSigarraStudentPhoto } from '@/infrastructure/external/sigarra-student-photo'
import type { Repositories } from '@/infrastructure/database/repositories'
import type { StudentPhotoProvider } from '@/domain/ports/student-photo.provider'
import type { AuthConfig } from '@/core/config/auth'

/**
 * Dependencies the interface layer receives from the composition root. Every
 * one can be overridden by a test, which is what keeps `tests/` free of a
 * database: pass a fake and the whole app still boots through `createApp()`.
 */
export type AppDependencies = {
  repositories: Partial<Repositories>
  auth: Partial<{
    config: AuthConfig
  }>
  studentPhotos: StudentPhotoProvider
}

export function createApp(dependencies: Partial<AppDependencies> = {}) {
  const defaults = createRepositories(db)
  const config = dependencies.auth?.config ?? loadAuthConfig()

  const repositories: Repositories = {
    ...defaults,
    ...dependencies.repositories,
  }

  const provider = createSigarraOidcProvider({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    authorizeEndpoint: config.authorizeEndpoint,
    tokenEndpoint: config.tokenEndpoint,
    userinfoEndpoint: config.userinfoEndpoint,
    scopes: config.scopes,
  })
  const sigarraDirect = createSigarraDirectAuth()

  const app = new Elysia({ adapter: 'Bun' in globalThis ? undefined : node() })
    // Composition root: the interface layer gets its dependencies from the
    // context and never imports `@/infrastructure/**` itself, which the
    // clean-architecture lint rule in `.oxlintrc.json` forbids. Constructing
    // the repository does not connect — the client is lazy — so `createApp()`
    // stays usable in tests without a database.
    .decorate('repositories', repositories)
    // Credentialed CORS: the frontend sends the session cookie cross-origin
    // in dev (`:3100` → `:3000`), so the origin must be explicit.
    .use(cors({ origin: config.allowedOrigins, credentials: true }))
    .use(errorHandler)

  if (process.env.NODE_ENV !== 'production') {
    app.use(openapiPlugin)
  }

  return app
    .use(
      createApiRoutes({
        provider,
        users: repositories.userRepository,
        sessions: repositories.sessionRepository,
        sigarraDirect,
        config,
        students: repositories.studentRepository,
        schedules: repositories.scheduleRepository,
        photos: dependencies.studentPhotos ?? createSigarraStudentPhoto(),
      }),
    )
    .get('/', () => ({ message: 'Hello from tts-be!' }))
}

export type App = ReturnType<typeof createApp>

// `import.meta.main` only exists under Bun. When the production bundle runs
// under Node (`node dist/server.mjs`), detect the entry module via argv[1].
const isMain =
  'Bun' in globalThis
    ? (import.meta as { main?: boolean }).main === true
    : import.meta.url === pathToFileURL(process.argv[1] ?? '').href

if (isMain) {
  const port = Number(process.env.PORT) || 3000
  const app = createApp().listen(port)
  console.log(`Server running at http://localhost:${app.server?.port ?? port}`)
}
