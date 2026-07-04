import { DataroomApiError } from '@dataroom/shared'
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { env } from '@/config/env'

export async function authRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // DEV login shortcut — returns a session JWT for a Clerk user by email.
  // Requires the user to already have an active session in Clerk (i.e. they've
  // signed in at least once via the frontend). Skips the frontend SDK entirely.
  server.post(
    '/auth/dev-login',
    {
      schema: {
        body: z.object({ email: z.string().email() }),
        response: {
          200: z.object({
            token: z.string(),
            userId: z.string(),
            sessionId: z.string(),
          }),
        },
      },
    },
    async (req) => {
      if (env.NODE_ENV === 'production') {
        throw new DataroomApiError('FORBIDDEN', 'dev-login disabled in production', 403)
      }

      const { email } = req.body

      const users = await app.clerk.users.getUserList({ emailAddress: [email] })
      const user = users.data[0]
      if (!user) {
        throw new DataroomApiError('NOT_FOUND', `No Clerk user with email ${email}`, 404)
      }

      const sessions = await app.clerk.sessions.getSessionList({
        userId: user.id,
        status: 'active',
      })
      const active = sessions.data[0]
      if (!active) {
        throw new DataroomApiError(
          'NOT_FOUND',
          'No active Clerk session — please sign in via the app once, then retry',
          404,
        )
      }

      const tokenRes = await fetch(`https://api.clerk.com/v1/sessions/${active.id}/tokens`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
      if (!tokenRes.ok) {
        throw new DataroomApiError('INTERNAL_ERROR', 'Failed to mint session token', 500)
      }
      const { jwt } = (await tokenRes.json()) as { jwt: string }

      return { token: jwt, userId: user.id, sessionId: active.id }
    },
  )
}
