type ClerkErrLike = { errors?: Array<{ code?: string; message?: string }>; message?: string }

/**
 * "Session already exists" fires when Clerk's client-side signIn/signUp resource
 * still holds status='complete' from a previous flow — surviving a signOut in
 * some flows. Detect it and let callers signOut + retry cleanly.
 */
export function isSessionExistsError(err: unknown): boolean {
  const e = err as ClerkErrLike
  const code = e?.errors?.[0]?.code ?? ''
  const message = String(e?.errors?.[0]?.message ?? e?.message ?? '').toLowerCase()
  return code === 'session_exists' || message.includes('session already exists')
}
