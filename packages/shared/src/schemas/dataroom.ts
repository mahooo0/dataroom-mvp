import { z } from 'zod'
import { idSchema, nameSchema, timestampsSchema } from './common'

export const DATAROOM_ICON_KEYS = [
  'eleven-agents',
  'eleven-creative',
  'orb-1',
  'orb-2',
  'orb-3',
] as const
export type DataroomIconKey = (typeof DATAROOM_ICON_KEYS)[number]

const iconKeySchema = z.enum(DATAROOM_ICON_KEYS).nullable().optional()

export const dataroomSchema = z
  .object({
    id: idSchema,
    name: z.string(),
    ownerId: z.string(),
    iconKey: iconKeySchema,
  })
  .merge(timestampsSchema)

export type Dataroom = z.infer<typeof dataroomSchema>

export const createDataroomInput = z.object({
  name: nameSchema,
  iconKey: iconKeySchema,
})
export type CreateDataroomInput = z.infer<typeof createDataroomInput>

export const renameDataroomInput = z.object({
  name: nameSchema.optional(),
  iconKey: iconKeySchema,
})
export type RenameDataroomInput = z.infer<typeof renameDataroomInput>

export const dataroomListResponse = z.object({
  datarooms: z.array(dataroomSchema),
})
export type DataroomListResponse = z.infer<typeof dataroomListResponse>
