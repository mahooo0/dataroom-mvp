import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_AUTHORIZED_PARTIES: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),

  DEV_LOGIN_SECRET: z.string().default(''),

  S3_ENDPOINT_INTERNAL: z.string().url(),
  S3_ENDPOINT_PUBLIC: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().default('dataroom-files'),

  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((s, ctx) => {
      const parts = s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
      if (process.env.NODE_ENV === 'production' && parts.some((o) => o === '*')) {
        ctx.addIssue({
          code: 'custom',
          message: 'ALLOWED_ORIGINS may not be "*" in production — enumerate the origins',
        })
        return z.NEVER
      }
      return parts.map<string | RegExp>((o) => (o.startsWith('re:') ? new RegExp(o.slice(3)) : o))
    }),

  USER_QUOTA_BYTES: z.coerce.number().int().positive().default(1_073_741_824),

  PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
export type Env = typeof env
