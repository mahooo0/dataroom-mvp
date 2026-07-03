import { z } from 'zod'

export const idSchema = z.string().uuid()

export const timestampsSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
})

export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(255, 'Name is too long')
  .refine((s) => !s.includes('/') && !s.includes('\\'), {
    message: 'Name cannot contain slashes',
  })

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  userId: z.string(),
  timestamp: z.string().datetime(),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>
