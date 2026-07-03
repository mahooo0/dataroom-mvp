import type { HTTPError } from 'ky'
import { ApiFailure } from '@/shared/api/client'

export function toApiFailure(err: unknown): ApiFailure | null {
  if (err instanceof ApiFailure) return err
  const wrapped = err as HTTPError & { apiFailure?: ApiFailure }
  if (wrapped?.apiFailure instanceof ApiFailure) return wrapped.apiFailure
  return null
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  const f = toApiFailure(err)
  if (f) return f.message
  if (err instanceof Error) return err.message
  return fallback
}
