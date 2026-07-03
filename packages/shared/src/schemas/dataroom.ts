import { z } from 'zod'
import { idSchema, nameSchema, timestampsSchema } from './common'

export const dataroomSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    ownerId: z.string(),
  })
  .merge(timestampsSchema)

export type Dataroom = z.infer<typeof dataroomSchema>

export const createDataroomInput = z.object({
  name: nameSchema,
})
export type CreateDataroomInput = z.infer<typeof createDataroomInput>

export const renameDataroomInput = z.object({
  name: nameSchema,
})
export type RenameDataroomInput = z.infer<typeof renameDataroomInput>

export const dataroomListResponse = z.object({
  datarooms: z.array(dataroomSchema),
})
export type DataroomListResponse = z.infer<typeof dataroomListResponse>
