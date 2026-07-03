import { ClerkProvider } from '@clerk/react'
import { shadcn } from '@clerk/ui/themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { type ReactNode, useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { env } from '@/shared/config/env'
import { applyTheme, useThemeStore } from '@/shared/lib/theme'

function ThemeSync() {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    applyTheme(theme)
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])
  return null
}

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, err) => {
              const status = (err as { status?: number })?.status
              if (status && status >= 400 && status < 500) return false
              return failureCount < 2
            },
          },
        },
      }),
  )

  return (
    <ClerkProvider publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY} appearance={{ theme: shadcn }}>
      <QueryClientProvider client={queryClient}>
        <ThemeSync />
        {children}
        <Toaster position="top-right" richColors closeButton />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ClerkProvider>
  )
}
