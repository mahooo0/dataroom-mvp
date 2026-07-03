import type { ReactNode } from 'react'

interface RootLayoutProps {
  children: ReactNode
}

/**
 * Root shell — intentionally minimal. AppHeader is added by the
 * authed AppShell only, so auth pages own the full viewport (and don't
 * cause a duplicate brand-mark layoutId, which would break the splash
 * → header shared-layout animation).
 */
export function RootLayout({ children }: RootLayoutProps) {
  return <div className="min-h-full">{children}</div>
}
