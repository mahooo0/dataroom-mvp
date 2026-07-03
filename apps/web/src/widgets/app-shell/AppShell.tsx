import type { ReactNode } from 'react'
import { AppHeader } from '@/widgets/header/AppHeader'

interface AppShellProps {
  children: ReactNode
}

/**
 * Layout for authenticated app routes — adds the sticky app header.
 * Public routes (sign-in / sign-up / sso-callback) skip this shell so
 * they can own the full viewport without a header competing for the
 * shared brand-mark layout id.
 */
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="flex-1">{children}</main>
    </div>
  )
}
