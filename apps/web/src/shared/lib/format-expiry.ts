/**
 * Human-readable countdown to a future ISO timestamp.
 *
 * Uses floor at each boundary so a link created now with TTL=24h reads
 * "23h" instead of "24h" — matches Google Drive convention and doesn't
 * over-promise remaining time. `short` returns just the number ("23h"),
 * `full` prefixes with "expires in".
 */
export function formatExpiryShort(iso: string, now: number = Date.now()): string {
  const diff = new Date(iso).getTime() - now
  if (diff <= 0) return 'expired'
  const minutes = Math.floor(diff / (60 * 1000))
  if (minutes < 60) return `${Math.max(1, minutes)}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function formatExpiryFull(iso: string, now: number = Date.now()): string {
  const diff = new Date(iso).getTime() - now
  if (diff <= 0) return 'expired'
  const minutes = Math.floor(diff / (60 * 1000))
  if (minutes < 60) return `expires in ${Math.max(1, minutes)}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `expires in ${hours}h`
  const days = Math.floor(hours / 24)
  return `expires in ${days} days`
}
