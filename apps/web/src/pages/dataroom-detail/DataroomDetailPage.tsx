import type { FileRecord, Folder } from '@dataroom/shared'
import { useNavigate } from '@tanstack/react-router'
import { AlertCircle, FolderPlus, Upload } from 'lucide-react'
import { useState } from 'react'
import { useDatarooms } from '@/entities/dataroom'
import { useFilesInFolder } from '@/entities/file'
import { childrenOf, findFolder, useFolders } from '@/entities/folder'
import { CreateFolderDialog } from '@/features/create-folder'
import { DeleteFolderDialog } from '@/features/delete-folder'
import { RenameFolderDialog } from '@/features/rename-folder'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { DataroomBreadcrumbs } from '@/widgets/breadcrumbs/DataroomBreadcrumbs'
import { EmptyFolderPane } from '@/widgets/file-grid/EmptyFolderPane'
import { FileGrid } from '@/widgets/file-grid/FileGrid'
import { FolderTree } from '@/widgets/folder-tree/FolderTree'

interface DataroomDetailPageProps {
  dataroomId: string
  folderId: string | null
}

export function DataroomDetailPage({ dataroomId, folderId }: DataroomDetailPageProps) {
  const navigate = useNavigate()
  const { data: datarooms } = useDatarooms()
  const {
    data: folders,
    isLoading: foldersLoading,
    isError: foldersError,
    refetch: refetchFolders,
  } = useFolders(dataroomId)
  const { data: files, isLoading: filesLoading, isError: filesError } = useFilesInFolder(folderId)

  const dataroom = datarooms?.find((d) => d.id === dataroomId)
  const currentFolder = findFolder(folders, folderId)
  const canUpload = folderId !== null

  const [createParent, setCreateParent] = useState<string | null | undefined>(undefined)
  const [renaming, setRenaming] = useState<Folder | null>(null)
  const [deleting, setDeleting] = useState<Folder | null>(null)

  const selectFolder = (id: string | null) => {
    void navigate({
      to: '/datarooms/$dataroomId',
      params: { dataroomId },
      search: id ? { folderId: id } : {},
      replace: false,
    })
  }

  if (!dataroom) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-lg font-medium">Dataroom not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been deleted or you may not have access.
        </p>
      </div>
    )
  }

  const rootChildFolders = folders ? childrenOf(folders, null) : []
  const currentChildFolders = folders ? childrenOf(folders, folderId) : []

  return (
    <div className="grid h-full grid-cols-[280px_1fr]">
      <aside className="flex flex-col overflow-y-auto border-r bg-muted/20 px-2">
        <div className="flex items-center justify-between px-2 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Folders
          </h2>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setCreateParent(null)}
            aria-label="New root folder"
            className="h-6 w-6"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {foldersLoading ? (
          <div className="space-y-2 px-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-4/6" />
          </div>
        ) : foldersError ? (
          <div className="flex flex-col items-center gap-2 px-2 py-4 text-center text-sm">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-muted-foreground">Couldn&apos;t load folders</span>
            <Button size="sm" variant="ghost" onClick={() => refetchFolders()}>
              Retry
            </Button>
          </div>
        ) : (
          <FolderTree
            folders={folders ?? []}
            selectedFolderId={folderId}
            onSelect={selectFolder}
            onCreateChild={(parentId) => setCreateParent(parentId)}
            onRename={(f) => setRenaming(f)}
            onDelete={(f) => setDeleting(f)}
          />
        )}
      </aside>

      <section className="flex flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/95 px-6 py-4 backdrop-blur">
          <DataroomBreadcrumbs
            dataroomName={dataroom.name}
            folders={folders ?? []}
            currentFolderId={folderId}
            onNavigate={selectFolder}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCreateParent(folderId)}>
              <FolderPlus className="mr-2 h-4 w-4" />
              New folder
            </Button>
            <Button
              disabled={!canUpload}
              title={!canUpload ? 'Open a folder to upload' : undefined}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </div>
        </header>

        <div className="flex-1 px-6 py-6">
          {filesLoading || (foldersLoading && folderId !== null) ? (
            <FolderPaneSkeleton />
          ) : filesError ? (
            <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center">
              <p className="text-sm text-destructive">Couldn&apos;t load files in this folder.</p>
            </div>
          ) : (
            <FolderPaneContent
              folderId={folderId}
              subfolders={folderId === null ? rootChildFolders : currentChildFolders}
              files={files ?? []}
              onSelectFolder={selectFolder}
              onCreateFolder={() => setCreateParent(folderId)}
              onUpload={() => {
                /* upload in next slice */
              }}
              onRenameFile={(_f: FileRecord) => {}}
              onDeleteFile={(_f: FileRecord) => {}}
              onOpenFile={(_f: FileRecord) => {}}
            />
          )}
        </div>
      </section>

      <CreateFolderDialog
        open={createParent !== undefined}
        dataroomId={dataroomId}
        parentId={createParent ?? null}
        onOpenChange={(open) => !open && setCreateParent(undefined)}
      />
      <RenameFolderDialog folder={renaming} onClose={() => setRenaming(null)} />
      <DeleteFolderDialog folder={deleting} onClose={() => setDeleting(null)} />
    </div>
  )
}

function FolderPaneSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton set
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  )
}

interface FolderPaneContentProps {
  folderId: string | null
  subfolders: Folder[]
  files: FileRecord[]
  onSelectFolder: (id: string) => void
  onCreateFolder: () => void
  onUpload: () => void
  onRenameFile: (f: FileRecord) => void
  onDeleteFile: (f: FileRecord) => void
  onOpenFile: (f: FileRecord) => void
}

function FolderPaneContent({
  folderId,
  subfolders,
  files,
  onSelectFolder,
  onCreateFolder,
  onUpload,
  onRenameFile,
  onDeleteFile,
  onOpenFile,
}: FolderPaneContentProps) {
  const isEmpty = subfolders.length === 0 && files.length === 0

  if (isEmpty) {
    return (
      <EmptyFolderPane
        canUpload={folderId !== null}
        onCreateFolder={onCreateFolder}
        onUpload={onUpload}
      />
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {subfolders.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Folders
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {subfolders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelectFolder(f.id)}
                disabled={f.id.startsWith('temp-')}
                className="flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary/60 hover:shadow-sm"
              >
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <FolderPlus className="h-5 w-5" aria-hidden />
                </div>
                <div className="w-full">
                  <h4 className="line-clamp-2 text-sm font-medium">{f.name}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(f.childFolderCount ?? 0) + (f.fileCount ?? 0)} items
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      {files.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Files
          </h3>
          <FileGrid
            files={files}
            onOpen={onOpenFile}
            onRename={onRenameFile}
            onDelete={onDeleteFile}
          />
        </section>
      )}
    </div>
  )
}
