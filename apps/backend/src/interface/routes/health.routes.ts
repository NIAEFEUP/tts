import { Elysia, t } from 'elysia'

// Response schema + `detail` so the OpenAPI plugin generates a documented
// operation (tag, summary, body) instead of a bare path.
export const healthRoutes = new Elysia({ prefix: '/health' }).get(
  '/',
  () => ({
    status: 'ok' as const,
  }),
  {
    response: { 200: t.Object({ status: t.Literal('ok') }) },
    detail: { tags: ['health'], summary: 'Health check' },
  },
)
