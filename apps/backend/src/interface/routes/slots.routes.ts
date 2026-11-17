import { Elysia, t } from 'elysia'

import type { SlotRepository } from '@/domain/ports/slot.repository'
import type { SessionRepository } from '@/domain/ports/session.repository'
import { HttpError } from '@/interface/errors/errors'
import { createRequiredAuthMiddleware } from '@/interface/middleware/auth.middleware'
import { apiError } from '@/interface/middleware/error-handler'
import { professorSchema, slotDetailsSchema } from './users/schemas'

type SlotDependencies = {
  decorator: {
    repositories: {
      slotRepository: SlotRepository
    }
  }
  store: {}
  derive: {}
  resolve: {}
}

export type SlotRoutesDeps = {
  sessions: SessionRepository
}

export const slotRoutes = ({ sessions }: SlotRoutesDeps) =>
  new Elysia<'/v1/slots', SlotDependencies>({ prefix: '/v1/slots' })
    .use(createRequiredAuthMiddleware({ resolveSession: sessions.resolve }))
    .model({ ApiError: apiError })
    .get(
      '/:id',
      async ({ repositories, params }) => {
        const slot = await repositories.slotRepository.findById(params.id)
        if (!slot) throw new HttpError('slot-not-found', `Schedule slot ${params.id} not found`, 404)

        return slot
      },
      {
        response: { 200: slotDetailsSchema, 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        detail: { tags: ['slots'], summary: 'Get one schedule slot' },
      },
    )
    .get(
      '/:id/professors',
      async ({ repositories, params }) => {
        const slot = await repositories.slotRepository.findById(params.id)
        if (!slot) throw new HttpError('slot-not-found', `Schedule slot ${params.id} not found`, 404)

        return slot.professors
      },
      {
        response: { 200: t.Array(professorSchema), 404: 'ApiError' },
        params: t.Object({ id: t.Integer() }),
        detail: { tags: ['slots'], summary: 'List professors assigned to a slot' },
      },
    )
