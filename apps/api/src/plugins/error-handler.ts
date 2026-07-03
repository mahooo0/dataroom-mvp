import { DataroomApiError } from '@dataroom/shared'
import type { FastifyError, FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

export const errorHandlerPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'Request failed')

    if (error instanceof DataroomApiError) {
      return reply.status(error.statusCode).send(error.toJSON())
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        code: 'VALIDATION_FAILED',
        message: 'Request payload validation failed',
        details: { issues: error.validation },
      })
    }

    const status = error.statusCode ?? 500
    return reply.status(status).send({
      code: status >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED',
      message: status >= 500 ? 'Internal server error' : error.message,
    })
  })

  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      code: 'NOT_FOUND',
      message: 'Route not found',
    })
  })
})
