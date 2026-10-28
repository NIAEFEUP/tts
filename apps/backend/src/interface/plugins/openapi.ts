import { Elysia } from 'elysia'
import { openapi } from '@elysia/openapi'
import { apiError } from '@/interface/middleware/error-handler'

/** The slice of the generated document the sanitizer below touches. */
type OpenApiDocument = {
  openapi: string
  paths: Record<string, Record<string, { responses?: Record<string, { content?: { type?: string } }> }>>
}

function isOpenApiDocument(value: unknown): value is OpenApiDocument {
  return typeof value === 'object' && value !== null && 'openapi' in value && 'paths' in value
}

/**
 * `@elysia/openapi` renders a bodyless response declared with `t.Void()` (the
 * 3xx redirects) as `content: { type: 'void' }`. That is not a valid OpenAPI
 * Response Object — `content` must map media types to media type objects — so
 * drop the key from the document we serve. The status is still described, just
 * without a body.
 *
 * Only the generated document is touched; every other response keeps its
 * content. The spec route returns the document as a plain object (before
 * serialization), which is what `onAfterHandle` receives.
 */
function withoutVoidContent(document: OpenApiDocument): OpenApiDocument {
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(pathItem)) {
      for (const response of Object.values(operation.responses ?? {})) {
        if (response.content?.type === 'void') delete response.content
      }
    }
  }

  return document
}

/**
 * OpenAPI documentation plugin.
 *
 * Serves a Scalar UI at `/openapi`. The shared `ApiError` schema is
 * registered as a named model and referenced by name in route response
 * schemas, so the spec inlines it only once under `#/components/schemas`.
 *
 * The route-level `detail` metadata (tags, summaries) lives alongside each
 * route definition — this plugin only wires up the documentation config.
 */
export const openapiPlugin = new Elysia({ name: 'openapi' })
  .model({ ApiError: apiError })
  .onAfterHandle(({ response }) => {
    // The Scalar page is a `Response`; only the spec route returns a document.
    if (isOpenApiDocument(response)) return withoutVoidContent(response)
  })
  .use(
    openapi({
      documentation: {
        info: {
          title: 'TTS API',
          version: '1.0.0',
          description: 'Course exchange platform API',
        },
        tags: [
          { name: 'health', description: 'Health check endpoints' },
          { name: 'auth', description: 'Authentication and session endpoints' },
          { name: 'auth-compat', description: 'Legacy auth routes for the un-migrated frontend' },
          { name: 'faculties', description: 'Faculty catalog' },
          { name: 'courses', description: 'Course catalog' },
          { name: 'course-units', description: 'Abstract course unit catalog' },
        ],
      },
    }),
  )
