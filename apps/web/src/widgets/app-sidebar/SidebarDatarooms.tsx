import type { Folder } from '@dataroom/shared'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { AlertCircle, ChevronRight, FolderOpen, Loader2, Plus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DataroomOrb, useDatarooms } from '@/entities/dataroom'
import { useFolders } from '@/entities/folder'
import { CreateDataroomDialog } from '@/features/create-dataroom'
import { CreateFolderDialog } from '@/features/create-folder'
import { DeleteFolderDialog } from '@/features/delete-folder'
import { RenameFolderDialog } from '@/features/rename-folder'
import { useIconFilterStore } from '@/features/search'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/animate-ui/components/radix/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/animate-ui/primitives/radix/collapsible'
import { Skeleton } from '@/shared/ui/skeleton'
import { FolderTree } from '@/widgets/folder-tree/FolderTree'

interface ActiveRoute {
  dataroomId: string | null
  folderId: string | null
}

function parseActiveRoute(pathname: string, search: string): ActiveRoute {
  const match = pathname.match(/^\/datarooms\/([^/?#]+)/)
  const dataroomId = match ? decodeURIComponent(match[1]) : null
  const folderId = new URLSearchParams(search).get('folderId')
  return { dataroomId, folderId: folderId ?? null }
}

const HOVER_OPEN_DELAY = 250

export function SidebarDatarooms() {
  const { data: allDatarooms, isLoading, isError, refetch } = useDatarooms()
  const iconFilter = useIconFilterStore((s) => s.iconKey)
  const datarooms = useMemo(
    () => (iconFilter ? allDatarooms?.filter((d) => d.iconKey === iconFilter) : allDatarooms),
    [allDatarooms, iconFilter],
  )
  const { pathname, searchStr } = useLocation({
    select: (loc) => ({ pathname: loc.pathname, searchStr: loc.searchStr }),
  })
  const active = useMemo(() => parseActiveRoute(pathname, searchStr), [pathname, searchStr])

  const [openId, setOpenId] = useState<string | null>(active.dataroomId)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (active.dataroomId) setOpenId(active.dataroomId)
  }, [active.dataroomId])

  useEffect(
    () => () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
    },
    [],
  )

  const scheduleOpen = (id: string) => {
    if (openId === id) return
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setOpenId(id), HOVER_OPEN_DELAY)
  }
  const cancelSchedule = () => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }

  const [createParent, setCreateParent] = useState<{
    dataroomId: string
    parentId: string | null
  } | null>(null)
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null)
  const [createDataroomOpen, setCreateDataroomOpen] = useState(false)

  const isOnDataroomsIndex = pathname === '/datarooms' || pathname === '/datarooms/'

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isOnDataroomsIndex}
              tooltip="Datarooms"
              className="pr-8"
            >
              <Link to="/datarooms">
                <FolderOpen />
                <span>Datarooms</span>
              </Link>
            </SidebarMenuButton>
            <SidebarMenuAction
              onClick={() => setCreateDataroomOpen(true)}
              aria-label="New dataroom"
            >
              <Plus />
            </SidebarMenuAction>
          </SidebarMenuItem>
          {isLoading ? (
            <div className="space-y-1 px-2 py-1 group-data-[collapsible=icon]:hidden">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-5/6" />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-start gap-1 px-2 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              <span className="flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                Couldn&apos;t load
              </span>
              <button
                type="button"
                onClick={() => refetch()}
                className="text-xs underline underline-offset-2"
              >
                Retry
              </button>
            </div>
          ) : !datarooms || datarooms.length === 0 ? (
            <div className="px-2 py-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              No datarooms yet
            </div>
          ) : (
            datarooms.map((dr) => {
              const isOpen = openId === dr.id
              const isActive = active.dataroomId === dr.id
              const isRootActive = isActive && active.folderId === null

              return (
                <Collapsible
                  key={dr.id}
                  open={isOpen}
                  onOpenChange={(open) => setOpenId(open ? dr.id : null)}
                  asChild
                  className="group/dr"
                >
                  <SidebarMenuItem
                    onMouseEnter={() => scheduleOpen(dr.id)}
                    onMouseLeave={cancelSchedule}
                  >
                    <SidebarMenuButton
                      asChild
                      isActive={isRootActive}
                      tooltip={dr.name}
                      className="pr-8"
                    >
                      <Link to="/datarooms/$dataroomId" params={{ dataroomId: dr.id }}>
                        <DataroomOrb id={dr.id} iconKey={dr.iconKey} />
                        <span className="truncate">{dr.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuAction showOnHover aria-label={isOpen ? 'Collapse' : 'Expand'}>
                        <ChevronRight className="transition-transform duration-150 group-data-[state=open]/dr:rotate-90" />
                      </SidebarMenuAction>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <DataroomFolderSubtree
                        dataroomId={dr.id}
                        activeFolderId={isActive ? active.folderId : null}
                        isActiveDataroom={isActive}
                        onCreateChild={(parentId) =>
                          setCreateParent({ dataroomId: dr.id, parentId })
                        }
                        onRename={setRenamingFolder}
                        onDelete={setDeletingFolder}
                      />
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            })
          )}
        </SidebarMenu>
      </SidebarGroupContent>

      <CreateDataroomDialog open={createDataroomOpen} onOpenChange={setCreateDataroomOpen} />
      <CreateFolderDialog
        open={createParent !== null}
        dataroomId={createParent?.dataroomId ?? ''}
        parentId={createParent?.parentId ?? null}
        onOpenChange={(open) => !open && setCreateParent(null)}
      />
      <RenameFolderDialog folder={renamingFolder} onClose={() => setRenamingFolder(null)} />
      <DeleteFolderDialog folder={deletingFolder} onClose={() => setDeletingFolder(null)} />
    </SidebarGroup>
  )
}

interface DataroomFolderSubtreeProps {
  dataroomId: string
  activeFolderId: string | null
  isActiveDataroom: boolean
  onCreateChild: (parentId: string | null) => void
  onRename: (folder: Folder) => void
  onDelete: (folder: Folder) => void
}

function DataroomFolderSubtree({
  dataroomId,
  activeFolderId,
  isActiveDataroom,
  onCreateChild,
  onRename,
  onDelete,
}: DataroomFolderSubtreeProps) {
  const navigate = useNavigate()
  const { data: folders, isLoading, isError, refetch } = useFolders(dataroomId)

  const selectFolder = (id: string | null) => {
    void navigate({
      to: '/datarooms/$dataroomId',
      params: { dataroomId },
      search: id ? { folderId: id } : {},
    })
  }

  if (isLoading) {
    return (
      <div className="px-4 py-2 text-xs text-muted-foreground">
        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
        Loading…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        <button type="button" onClick={() => refetch()} className="underline underline-offset-2">
          Retry
        </button>
      </div>
    )
  }

  return (
    <FolderTree
      dataroomId={dataroomId}
      folders={folders ?? []}
      selectedFolderId={isActiveDataroom ? activeFolderId : null}
      onSelect={selectFolder}
      onCreateChild={onCreateChild}
      onRename={onRename}
      onDelete={onDelete}
    />
  )
}
