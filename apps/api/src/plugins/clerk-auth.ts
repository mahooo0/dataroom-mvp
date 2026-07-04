import { createClerkClient, verifyToken } from '@clerk/backend'
import { DataroomApiError } from '@dataroom/shared'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { env } from '@/config/env'

declare module 'fastify' {
  interface FastifyRequest {
    auth: {
      userId: string
    }
  }
}

const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY })

export const clerkAuthPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest('auth', null as unknown as { userId: string })

  app.decorate('requireAuth', async (request: import('fastify').FastifyRequest) => {
    const header = request.headers.authorization
    if (!header?.toLowerCase().startsWith('bearer ')) {
      throw new DataroomApiError('UNAUTHORIZED', 'Missing bearer token', 401)
    }
    const token = header.slice(7).trim()
    try {
      const payload = await verifyToken(token, {
        secretKey: env.CLERK_SECRET_KEY,
        ...(env.CLERK_AUTHORIZED_PARTIES.length > 0
          ? { authorizedParties: env.CLERK_AUTHORIZED_PARTIES }
          : {}),
      })
      if (!payload.sub) {
        throw new DataroomApiError('UNAUTHORIZED', 'Invalid token', 401)
      }
      request.auth = { userId: payload.sub }
    } catch (err) {
      if (err instanceof DataroomApiError) throw err
      throw new DataroomApiError('UNAUTHORIZED', 'Token verification failed', 401)
    }
  })

  app.decorate('clerk', clerk)
})

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: import('fastify').FastifyRequest) => Promise<void>
    clerk: typeof clerk
  }
}
