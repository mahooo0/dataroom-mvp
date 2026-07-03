import { useLocation } from '@tanstack/react-router'
import { useMemo } from 'react'
import { SidebarTrigger } from '@/shared/ui/animate-ui/components/radix/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/breadcrumb'
import { Separator } from '@/shared/ui/separator'
import { SearchDialog } from '@/widgets/header/SearchDialog'
import { ThemeToggle } from '@/widgets/header/ThemeToggle'

const LABELS: Record<string, string> = {
  datarooms: 'Datarooms',
  trash: 'Trash',
  settings: 'Settings',
}

function humanize(segment: string) {
  return LABELS[segment] ?? segment.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

export function AppHeader() {
  const { pathname } = useLocation()

  const crumbs = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean)
    return parts.map((part, idx) => ({
      label: humanize(part),
      href: `/${parts.slice(0, idx + 1).join('/')}`,
      isLast: idx === parts.length - 1,
    }))
  }, [pathname])

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.length === 0 ? (
            <BreadcrumbItem>
              <BreadcrumbPage>Home</BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            crumbs.map((crumb) => (
              <div key={crumb.href} className="contents">
                <BreadcrumbItem>
                  {crumb.isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {crumb.isLast ? null : <BreadcrumbSeparator />}
              </div>
            ))
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <SearchDialog />
        <ThemeToggle />
      </div>
    </header>
  )
}
