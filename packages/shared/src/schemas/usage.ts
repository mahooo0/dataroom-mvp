import { z } from 'zod'
import { idSchema } from './common'

export const dataroomUsageEntry = z.object({
  dataroomId: idSchema,
  name: z.string(),
  bytes: z.number().int().nonnegative(),
})
export type DataroomUsageEntry = z.infer<typeof dataroomUsageEntry>

export const usageResponse = z.object({
  usedBytes: z.number().int().nonnegative(),
  quotaBytes: z.number().int().positive(),
  perDataroom: z.array(dataroomUsageEntry),
})
export type UsageResponse = z.infer<typeof usageResponse>
