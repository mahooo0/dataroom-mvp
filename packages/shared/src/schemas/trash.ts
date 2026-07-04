import { z } from 'zod'
import { idSchema } from './common'

export const trashItemKindSchema = z.enum(['dataroom', 'folder', 'file'])
export type TrashItemKind = z.infer<typeof trashItemKindSchema>

const trashCommon = {
  id: idSchema,
  name: z.string(),
  deletedAt: z.string().datetime(),
}

export const trashDataroomItem = z.object({
  kind: z.literal('dataroom'),
  ...trashCommon,
  iconKey: z.string().nullable().optional(),
  folderCount: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
})
export type TrashDataroomItem = z.infer<typeof trashDataroomItem>

export const trashFolderItem = z.object({
  kind: z.literal('folder'),
  ...trashCommon,
  dataroomId: idSchema,
  dataroomName: z.string(),
  folderCount: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
})
export type TrashFolderItem = z.infer<typeof trashFolderItem>

export const trashFileItem = z.object({
  kind: z.literal('file'),
  ...trashCommon,
  folderId: idSchema,
  dataroomId: idSchema,
  dataroomName: z.string(),
  folderName: z.string(),
  sizeBytes: z.number().int().nonnegative(),
})
export type TrashFileItem = z.infer<typeof trashFileItem>

export const trashItem = z.discriminatedUnion('kind', [
  trashDataroomItem,
  trashFolderItem,
  trashFileItem,
])
export type TrashItem = z.infer<typeof trashItem>

export const trashListResponse = z.object({
  items: z.array(trashItem),
})
export type TrashListResponse = z.infer<typeof trashListResponse>

export const trashParams = z.object({
  kind: trashItemKindSchema,
  id: idSchema,
})
export type TrashParams = z.infer<typeof trashParams>
