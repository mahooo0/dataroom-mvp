import { z } from 'zod'
import { idSchema } from './common'

export const shareSchema = z.object({
  id: idSchema,
  fileId: idSchema,
  token: z.string().min(16),
  createdAt: z.string(),
  shareUrl: z.string().url(),
})
export type Share = z.infer<typeof shareSchema>

export const shareResponse = z.object({
  share: shareSchema.nullable(),
})
export type ShareResponse = z.infer<typeof shareResponse>

export const publicFileResponse = z.object({
  file: z.object({
    id: idSchema,
    name: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    updatedAt: z.string(),
  }),
  downloadUrl: z.string().url(),
  expiresIn: z.number().int().positive(),
})
export type PublicFileResponse = z.infer<typeof publicFileResponse>
