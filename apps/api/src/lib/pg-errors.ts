import { DataroomApiError, type ErrorCode } from '@dataroom/shared'

const UNIQUE_VIOLATION = '23505'

interface PgError {
  code?: string
  constraint_name?: string
}

export function mapUniqueViolation(err: unknown, code: ErrorCode, message: string): never {
  const pgErr = err as PgError
  if (pgErr?.code === UNIQUE_VIOLATION) {
    throw new DataroomApiError(code, message, 409)
  }
  throw err
}
