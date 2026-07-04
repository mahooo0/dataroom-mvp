import { DataroomApiError, type ErrorCode } from '@dataroom/shared'

const UNIQUE_VIOLATION = '23505'

interface PgError {
  code?: string
  constraint_name?: string
  cause?: PgError
}

/**
 * Unwrap postgres-js errors from drizzle's transaction wrapper. Direct
 * queries throw a `PostgresError` with `.code` set; queries inside
 * `db.transaction(...)` throw a `DrizzleQueryError` that stashes the
 * original PostgresError under `.cause`.
 */
function findPgCode(err: unknown): string | undefined {
  let cur = err as PgError | undefined
  for (let depth = 0; cur && depth < 4; depth++) {
    if (cur.code) return cur.code
    cur = cur.cause
  }
  return undefined
}

export function mapUniqueViolation(err: unknown, code: ErrorCode, message: string): never {
  if (findPgCode(err) === UNIQUE_VIOLATION) {
    throw new DataroomApiError(code, message, 409)
  }
  throw err
}
