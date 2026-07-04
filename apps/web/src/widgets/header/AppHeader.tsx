import { useLocation, useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useDatarooms } from '@/entities/dataroom'
import { useFolders } from '@/entities/folder'
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
import { DataroomBreadcrumbs } from '@/widgets/breadcrumbs/DataroomBreadcrumbs'
import { IconFilter } from '@/widgets/header/IconFilter'
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

function parseDataroomRoute(pathname: string, searchStr: string) {
  const match = pathname.match(/^\/datarooms\/([^/?#]+)/)
  if (!match) return null
  const folderId = new URLSearchParams(searchStr).get('folderId')
  return { dataroomId: decodeURIComponent(match[1]), folderId }
}

export function AppHeader() {
  const { pathname, searchStr } = useLocation({
    select: (loc) => ({ pathname: loc.pathname, searchStr: loc.searchStr }),
  })
  const navigate = useNavigate()

  const dataroomRoute = useMemo(
    () => parseDataroomRoute(pathname, searchStr),
    [pathname, searchStr],
  )

  const { data: datarooms } = useDatarooms()
  const { data: folders } = useFolders(dataroomRoute?.dataroomId)
  const currentDataroom = dataroomRoute
    ? datarooms?.find((d) => d.id === dataroomRoute.dataroomId)
    : undefined

  const genericCrumbs = useMemo(() => {
    if (dataroomRoute) return []
    const parts = pathname.split('/').filter(Boolean)
    return parts.map((part, idx) => ({
      label: humanize(part),
      href: `/${parts.slice(0, idx + 1).join('/')}`,
      isLast: idx === parts.length - 1,
    }))
  }, [pathname, dataroomRoute])

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-4" />

      {dataroomRoute && currentDataroom ? (
        <DataroomBreadcrumbs
          dataroomName={currentDataroom.name}
          folders={folders ?? []}
          currentFolderId={dataroomRoute.folderId}
          onNavigate={(folderId) =>
            void navigate({
              to: '/datarooms/$dataroomId',
              params: { dataroomId: dataroomRoute.dataroomId },
              search: folderId ? { folderId } : {},
            })
          }
        />
      ) : (
        <Breadcrumb>
          <BreadcrumbList>
            {genericCrumbs.length === 0 ? (
              <BreadcrumbItem>
                <BreadcrumbPage>Home</BreadcrumbPage>
              </BreadcrumbItem>
            ) : (
              genericCrumbs.map((crumb) => (
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
      )}

      <div className="ml-auto flex items-center gap-2">
        <IconFilter />
        <SearchDialog />
        <ThemeToggle />
      </div>
    </header>
  )
}
