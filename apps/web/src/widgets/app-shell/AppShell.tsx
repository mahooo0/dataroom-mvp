import type { ReactNode } from 'react'
import { SidebarInset, SidebarProvider } from '@/shared/ui/animate-ui/components/radix/sidebar'
import { AppSidebar } from '@/widgets/app-sidebar/AppSidebar'
import { AppHeader } from '@/widgets/header/AppHeader'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
