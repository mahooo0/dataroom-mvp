import { z } from 'zod'
import { idSchema } from './common'
import { DATAROOM_ICON_KEYS } from './dataroom'

export const searchQuerySchema = z.object({
  q: z.string().max(200).optional().default(''),
  iconKey: z.enum(DATAROOM_ICON_KEYS).optional(),
})
export type SearchQuery = z.infer<typeof searchQuerySchema>

export const searchDataroomHit = z.object({
  id: idSchema,
  name: z.string(),
  iconKey: z.enum(DATAROOM_ICON_KEYS).nullable(),
})
export type SearchDataroomHit = z.infer<typeof searchDataroomHit>

export const searchFolderHit = z.object({
  id: idSchema,
  name: z.string(),
  dataroomId: idSchema,
  dataroomName: z.string(),
})
export type SearchFolderHit = z.infer<typeof searchFolderHit>

export const searchFileHit = z.object({
  id: idSchema,
  name: z.string(),
  folderId: idSchema,
  dataroomId: idSchema,
  dataroomName: z.string(),
  folderName: z.string(),
})
export type SearchFileHit = z.infer<typeof searchFileHit>

export const searchResponse = z.object({
  datarooms: z.array(searchDataroomHit),
  folders: z.array(searchFolderHit),
  files: z.array(searchFileHit),
})
export type SearchResponse = z.infer<typeof searchResponse>
