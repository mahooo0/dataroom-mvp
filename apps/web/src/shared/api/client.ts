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
    prefixUrl: env.VITE_API_URL,
    timeout: 30_000,
    retry: {
      limit: 1,
      statusCodes: [401],
    },
    hooks: {
      beforeRequest: [
        async (request) => {
          const token = await getToken()
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`)
          }
        },
      ],
      beforeError: [
        async (error) => {
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
