import { z } from 'zod'
import { idSchema } from './common'
import { DATAROOM_ICON_KEYS } from './dataroom'

const iconKeySchema = z.enum(DATAROOM_ICON_KEYS).nullable().optional()

export const shareSchema = z.object({
  id: idSchema,
  dataroomId: idSchema,
  token: z.string().min(16),
  createdAt: z.string(),
  shareUrl: z.string().url(),
})
export type Share = z.infer<typeof shareSchema>

export const shareResponse = z.object({
  share: shareSchema.nullable(),
})
export type ShareResponse = z.infer<typeof shareResponse>

const publicFolderSchema = z.object({
  id: idSchema,
  parentId: idSchema.nullable(),
  name: z.string(),
})
export type PublicFolder = z.infer<typeof publicFolderSchema>

const publicFileSchema = z.object({
  id: idSchema,
  folderId: idSchema,
  name: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  updatedAt: z.string(),
})
export type PublicFile = z.infer<typeof publicFileSchema>

export const publicDataroomResponse = z.object({
  dataroom: z.object({
    id: idSchema,
    name: z.string(),
    iconKey: iconKeySchema,
  }),
  folders: z.array(publicFolderSchema),
  files: z.array(publicFileSchema),
})
export type PublicDataroomResponse = z.infer<typeof publicDataroomResponse>

export const publicDownloadUrlResponse = z.object({
  url: z.string().url(),
  expiresIn: z.number().int().positive(),
})
export type PublicDownloadUrlResponse = z.infer<typeof publicDownloadUrlResponse>
