import { useAuth } from '@clerk/react'
import { type ApiError, apiErrorSchema } from '@dataroom/shared'
import ky, { HTTPError, type KyInstance } from 'ky'
import { useMemo } from 'react'
import { env } from '@/shared/config/env'

export class ApiFailure extends Error {
  readonly code: string
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(error: ApiError, status: number) {
    super(error.message)
    this.name = 'ApiFailure'
    this.code = error.code
    this.status = status
    this.details = error.details
  }
}

async function parseKyError(err: unknown): Promise<never> {
  if (err instanceof HTTPError) {
    try {
      const body = await err.response.clone().json()
      const parsed = apiErrorSchema.safeParse(body)
      if (parsed.success) {
        throw new ApiFailure(parsed.data, err.response.status)
      }
    } catch (inner) {
      if (inner instanceof ApiFailure) throw inner
    }
  }
  throw err
}

function baseClient(getToken: () => Promise<string | null>): KyInstance {
  return ky.create({
    prefix: env.VITE_API_URL,
    timeout: 30_000,
    retry: {
      limit: 1,
      statusCodes: [401],
    },
    hooks: {
      beforeRequest: [
        async ({ request }) => {
          try {
            const token = await getToken()
            if (token) {
              request.headers.set('Authorization', `Bearer ${token}`)
            }
          } catch {
            // Clerk session not ready yet; API returns 401 and React Query retries once
          }
        },
      ],
      beforeError: [
        async ({ error }) => {
          try {
            await parseKyError(error)
          } catch (inner) {
            if (inner instanceof ApiFailure) {
              const wrapped = error as HTTPError & { apiFailure?: ApiFailure }
              wrapped.apiFailure = inner
            }
          }
          return error
        },
      ],
    },
  })
}

export function useApi(): KyInstance {
  const { getToken } = useAuth()
  return useMemo(() => baseClient(() => getToken()), [getToken])
}

/**
 * Ky client without Clerk auth injection — used by the public /share/:token
 * flow where the caller may be unauthenticated. Prefer useApi() everywhere else.
 */
export const publicApi: KyInstance = ky.create({
  prefix: env.VITE_API_URL,
  timeout: 30_000,
  hooks: {
    beforeError: [
      async ({ error }) => {
        try {
          await parseKyError(error)
        } catch (inner) {
          if (inner instanceof ApiFailure) {
            const wrapped = error as HTTPError & { apiFailure?: ApiFailure }
            wrapped.apiFailure = inner
          }
        }
        return error
      },
    ],
  },
})
