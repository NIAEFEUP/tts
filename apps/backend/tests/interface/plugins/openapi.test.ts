import { describe, expect, it } from 'bun:test'
import { createApp } from '@/main'

// The OpenAPI plugin is only mounted outside production (see `main.ts`), so
// this drives the real app and asserts the generated document — the docs
// surface has no other coverage.

type Operation = {
  tags?: string[]
  summary?: string
  responses: Record<string, { content?: Record<string, { schema?: any }> }>
}

type Spec = {
  components: { schemas: Record<string, unknown> }
  paths: Record<string, Record<string, Operation>>
}

const app = createApp()

async function readSpec(): Promise<Spec> {
  const response = await app.handle(new Request('http://localhost/openapi/json'))
  expect(response.status).toBe(200)
  return (await response.json()) as Spec
}

// Every route the plugin should document, with the tag and summary it should
// carry: `[path, method, tag, summary]`.
const DOCUMENTED: Array<[string, string, string, string]> = [
  ['/health/', 'get', 'health', 'Health check'],
  ['/v1/auth/login', 'get', 'auth', 'Begin login'],
  ['/v1/auth/callback', 'get', 'auth', 'Complete login'],
  ['/v1/auth/me', 'get', 'auth', 'Current user'],
  ['/v1/auth/dev-login', 'post', 'auth', 'Dev login'],
  ['/v1/auth/logout', 'post', 'auth', 'Log out'],
  ['/oidc-auth/authenticate/', 'get', 'auth-compat', 'Legacy login link'],
  ['/oidc-auth/logout/', 'post', 'auth-compat', 'Legacy logout'],
  ['/auth/info/', 'get', 'auth-compat', 'Legacy session info'],
  ['/sigarra_login/', 'post', 'auth-compat', 'Legacy dev login'],
  ['/v1/students/{nmec}', 'get', 'students', 'Get a student profile'],
  ['/v1/students/{nmec}/photo', 'get', 'students', 'Get a student photo URL'],
  ['/v1/students/{nmec}/schedule', 'get', 'students', 'Get a student schedule'],
  ['/v1/students/{nmec}/courses/{courseId}/metadata', 'get', 'students', 'Get a student course metadata'],
]

describe('OpenAPI documentation', () => {
  it('tags and summarises every auth, health and students route', async () => {
    const spec = await readSpec()

    for (const [path, method, tag, summary] of DOCUMENTED) {
      const operation = spec.paths[path]?.[method]
      expect(operation).toBeDefined()
      expect(operation?.tags).toEqual([tag])
      expect(operation?.summary).toBe(summary)
    }
  })

  it('references the shared ApiError model from error responses', async () => {
    const spec = await readSpec()

    expect(spec.components.schemas.ApiError).toBeDefined()
    const unauthorized = spec.paths['/v1/auth/dev-login'].post.responses['401']
    expect(unauthorized.content?.['application/json']?.schema?.$ref).toBe('#/components/schemas/ApiError')
  })

  it('describes 3xx redirects without a body', async () => {
    const spec = await readSpec()

    // Guards the sanitizer: `t.Void()` must not reach the client as the
    // plugin's invalid `content: { type: 'void' }`.
    expect(spec.paths['/v1/auth/login'].get.responses['302']).not.toHaveProperty('content')
    expect(spec.paths['/v1/auth/callback'].get.responses['302']).not.toHaveProperty('content')
    expect(spec.paths['/oidc-auth/authenticate/'].get.responses['302']).not.toHaveProperty('content')
  })

  it('documents the health body as the literal it returns', async () => {
    const spec = await readSpec()
    const schema = spec.paths['/health/'].get.responses['200'].content?.['application/json']?.schema

    expect(schema?.properties?.status).toMatchObject({ const: 'ok' })
  })
})
