import { z } from 'zod'

const envSchema = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'Missing VITE_CLERK_PUBLISHABLE_KEY'),
  VITE_API_URL: z.string().url().default('http://localhost:3001'),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  console.error('❌ Invalid client env:', parsed.error.flatten().fieldErrors)
  throw new Error('Invalid client environment variables. See console for details.')
}

export const env = parsed.data
