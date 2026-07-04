import { z } from 'zod'
import { idSchema } from './common'

export const SHARE_TTL_OPTIONS = [
  { key: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', label: '30 days', ms: 30 * 24 * 60 * 60 * 1000 },
] as const
export const SHARE_TTL_KEYS = ['24h', '7d', '30d'] as const
export type ShareTtlKey = (typeof SHARE_TTL_KEYS)[number]
export const DEFAULT_SHARE_TTL_KEY: ShareTtlKey = '7d'

export const shareSchema = z.object({
  id: idSchema,
  fileId: idSchema,
  token: z.string().min(16),
  createdAt: z.string(),
  expiresAt: z.string(),
  allowDownload: z.boolean(),
  shareUrl: z.string().url(),
})
export type Share = z.infer<typeof shareSchema>

export const shareResponse = z.object({
  share: shareSchema.nullable(),
})
export type ShareResponse = z.infer<typeof shareResponse>

export const createShareInput = z.object({
  ttl: z.enum(SHARE_TTL_KEYS).default(DEFAULT_SHARE_TTL_KEY),
  allowDownload: z.boolean().default(false),
})
export type CreateShareInput = z.infer<typeof createShareInput>

export const publicFileResponse = z.object({
  file: z.object({
    id: idSchema,
    name: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    updatedAt: z.string(),
  }),
  downloadUrl: z.string().url(),
  expiresIn: z.number().int().positive(),
  allowDownload: z.boolean(),
  expiresAt: z.string(),
})
export type PublicFileResponse = z.infer<typeof publicFileResponse>
