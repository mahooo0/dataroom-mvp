import { z } from 'zod'
import { idSchema, nameSchema, timestampsSchema } from './common'

export const folderSchema = z
  .object({
    id: idSchema,
    dataroomId: idSchema,
    parentId: idSchema.nullable(),
    name: z.string(),
    childFolderCount: z.number().int().nonnegative().optional(),
    fileCount: z.number().int().nonnegative().optional(),
  })
  .merge(timestampsSchema)

export type Folder = z.infer<typeof folderSchema>

export const createFolderInput = z.object({
  dataroomId: idSchema,
  parentId: idSchema.nullable(),
  name: nameSchema,
})
export type CreateFolderInput = z.infer<typeof createFolderInput>

export const renameFolderInput = z.object({
  name: nameSchema,
})
export type RenameFolderInput = z.infer<typeof renameFolderInput>

export const moveFolderInput = z.object({
  parentId: idSchema.nullable(),
})
export type MoveFolderInput = z.infer<typeof moveFolderInput>

export const folderChildrenResponse = z.object({
  folders: z.array(folderSchema),
})
export type FolderChildrenResponse = z.infer<typeof folderChildrenResponse>

export const breadcrumbEntry = z.object({
  id: idSchema.nullable(),
  name: z.string(),
})
export type BreadcrumbEntry = z.infer<typeof breadcrumbEntry>

export const breadcrumbResponse = z.object({
  path: z.array(breadcrumbEntry),
})
export type BreadcrumbResponse = z.infer<typeof breadcrumbResponse>
