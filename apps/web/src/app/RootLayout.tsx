import type { ReactNode } from 'react'
import { AppHeader } from '@/widgets/header/AppHeader'

interface RootLayoutProps {
  children: ReactNode
}

export function RootLayout({ children }: RootLayoutProps) {
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="flex-1">{children}</main>
    </div>
  )
}
