import type { Folder } from '@dataroom/shared'
import { ChevronRight, Home } from 'lucide-react'
import { Fragment } from 'react/jsx-runtime'
import { findBreadcrumb } from '@/entities/folder'

interface DataroomBreadcrumbsProps {
  dataroomName: string
  folders: Folder[]
  currentFolderId: string | null
  onNavigate: (folderId: string | null) => void
}

export function DataroomBreadcrumbs({
  dataroomName,
  folders,
  currentFolderId,
  onNavigate,
}: DataroomBreadcrumbsProps) {
  const trail = findBreadcrumb(folders, currentFolderId)

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 overflow-x-auto text-sm">
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
      >
        <Home className="h-3.5 w-3.5" aria-hidden />
        <span className="max-w-[16ch] truncate">{dataroomName}</span>
      </button>

      {trail.map((folder, i) => {
        const isLast = i === trail.length - 1
        return (
          <Fragment key={folder.id}>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            {isLast ? (
              <span className="truncate rounded px-1.5 py-0.5 font-medium">{folder.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(folder.id)}
                className="truncate rounded px-1.5 py-0.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
              >
                {folder.name}
              </button>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
