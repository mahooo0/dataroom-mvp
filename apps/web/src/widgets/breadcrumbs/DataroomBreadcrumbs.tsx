import type { Folder } from '@dataroom/shared'
import { Folder as FolderIcon, Home } from 'lucide-react'
import { Fragment } from 'react/jsx-runtime'
import { findBreadcrumb } from '@/entities/folder'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/breadcrumb'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

interface DataroomBreadcrumbsProps {
  dataroomName: string
  folders: Folder[]
  currentFolderId: string | null
  onNavigate: (folderId: string | null) => void
}

const KEEP_LAST = 2

export function DataroomBreadcrumbs({
  dataroomName,
  folders,
  currentFolderId,
  onNavigate,
}: DataroomBreadcrumbsProps) {
  const trail = findBreadcrumb(folders, currentFolderId)
  const collapse = trail.length > KEEP_LAST + 1
  const hidden = collapse ? trail.slice(0, trail.length - KEEP_LAST) : []
  const visible = collapse ? trail.slice(trail.length - KEEP_LAST) : trail

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-sm">
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button
              type="button"
              onClick={() => onNavigate(null)}
              className="flex items-center gap-1.5"
            >
              <Home className="h-3.5 w-3.5" aria-hidden />
              <span className="max-w-[24ch] truncate">{dataroomName}</span>
            </button>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {collapse ? (
          <>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Show hidden folders"
                  className="flex items-center rounded-md px-1 py-0.5 hover:bg-accent"
                >
                  <BreadcrumbEllipsis />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {hidden.map((f) => (
                    <DropdownMenuItem key={f.id} onSelect={() => onNavigate(f.id)}>
                      <FolderIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{f.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
          </>
        ) : null}

        {visible.map((folder, i) => {
          const isLast = i === visible.length - 1
          return (
            <Fragment key={folder.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem className="min-w-0">
                {isLast ? (
                  <BreadcrumbPage className="max-w-[32ch] truncate">{folder.name}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <button
                      type="button"
                      onClick={() => onNavigate(folder.id)}
                      className="max-w-[24ch] truncate"
                    >
                      {folder.name}
                    </button>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
