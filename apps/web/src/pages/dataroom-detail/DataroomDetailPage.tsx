import type { FileRecord, Folder } from '@dataroom/shared'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { useNavigate } from '@tanstack/react-router'
import { FolderPlus } from 'lucide-react'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useDatarooms } from '@/entities/dataroom'
import { useFilesInFolder } from '@/entities/file'
import { childrenOf, useFolders } from '@/entities/folder'
import { CreateFolderDialog } from '@/features/create-folder'
import { useDeleteFile } from '@/features/delete-file'
import { RenameFileDialog } from '@/features/rename-file'
import { ShareFileDialog } from '@/features/share-file'
import { UploadingRow, UploadTrigger, UploadZone, useUploadStore } from '@/features/upload-file'
import { PdfViewerModal } from '@/features/view-pdf'
import type { FolderDragData, FolderDropData } from '@/shared/dnd'
import { cn } from '@/shared/lib/utils'
import { RippleButton, RippleButtonRipples } from '@/shared/ui/animate-ui/components/buttons/ripple'
import { Skeleton } from '@/shared/ui/skeleton'
import { EmptyFolderPane } from '@/widgets/file-grid/EmptyFolderPane'
import { FileGrid } from '@/widgets/file-grid/FileGrid'

interface DataroomDetailPageProps {
  dataroomId: string
  folderId: string | null
}

export function DataroomDetailPage({ dataroomId, folderId }: DataroomDetailPageProps) {
  const navigate = useNavigate()
  const { data: datarooms } = useDatarooms()
  const { data: folders, isLoading: foldersLoading } = useFolders(dataroomId)
  const { data: files, isLoading: filesLoading, isError: filesError } = useFilesInFolder(folderId)
  const uploadSessions = useUploadStore(
    useShallow((s) => (folderId ? s.sessions.filter((sess) => sess.folderId === folderId) : [])),
  )

  const dataroom = datarooms?.find((d) => d.id === dataroomId)
  const canUpload = folderId !== null

  const [createParent, setCreateParent] = useState<string | null | undefined>(undefined)
  const [renamingFile, setRenamingFile] = useState<FileRecord | null>(null)
  const [sharingFile, setSharingFile] = useState<FileRecord | null>(null)
  const [viewingFile, setViewingFile] = useState<FileRecord | null>(null)
  const deleteFile = useDeleteFile()

  const selectFolder = (id: string | null) => {
    void navigate({
      to: '/datarooms/$dataroomId',
      params: { dataroomId },
      search: { folderId: id ?? undefined },
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
  const visibleSubfolders = folderId === null ? rootChildFolders : currentChildFolders

  const onFileDelete = (file: FileRecord) =>
    deleteFile.mutate({ id: file.id, folderId: file.folderId, name: file.name })

  return (
    <section className="flex h-full flex-col overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center justify-end gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <RippleButton variant="outline" onClick={() => setCreateParent(folderId)}>
          <FolderPlus className="mr-2 h-4 w-4" />
          <span className="hidden sm:inline">New folder</span>
          <span className="sm:hidden">Folder</span>
          <RippleButtonRipples />
        </RippleButton>
        {canUpload && folderId ? (
          <UploadTrigger folderId={folderId} />
        ) : (
          <RippleButton disabled title="Open a folder to upload">
            Upload
            <RippleButtonRipples />
          </RippleButton>
        )}
      </div>

      <div className="flex-1 px-4 py-4 sm:px-6 sm:py-6">
        {filesLoading || (foldersLoading && folderId !== null) ? (
          <FolderPaneSkeleton />
        ) : filesError ? (
          <div className="rounded-xl border border-dashed bg-card/40 p-8 text-center">
            <p className="text-sm text-destructive">Couldn&apos;t load files in this folder.</p>
          </div>
        ) : canUpload && folderId ? (
          <UploadZone folderId={folderId} className="min-h-[60vh]">
            <FolderPaneContent
              dataroomId={dataroomId}
              folderId={folderId}
              subfolders={visibleSubfolders}
              files={files ?? []}
              uploadRows={
                uploadSessions.length > 0 && (
                  <section className="space-y-2">
                    {uploadSessions.map((sess) => (
                      <UploadingRow key={sess.id} session={sess} />
                    ))}
                  </section>
                )
              }
              onSelectFolder={selectFolder}
              onCreateFolder={() => setCreateParent(folderId)}
              onUpload={() =>
                document.querySelector<HTMLInputElement>('input[type="file"]')?.click()
              }
              onRenameFile={setRenamingFile}
              onShareFile={setSharingFile}
              onDeleteFile={onFileDelete}
              onOpenFile={setViewingFile}
            />
          </UploadZone>
        ) : (
          <FolderPaneContent
            dataroomId={dataroomId}
            folderId={folderId}
            subfolders={visibleSubfolders}
            files={files ?? []}
            uploadRows={null}
            onSelectFolder={selectFolder}
            onCreateFolder={() => setCreateParent(folderId)}
            onUpload={() => {}}
            onRenameFile={setRenamingFile}
            onShareFile={setSharingFile}
            onDeleteFile={onFileDelete}
            onOpenFile={setViewingFile}
          />
        )}
      </div>

      <CreateFolderDialog
        open={createParent !== undefined}
        dataroomId={dataroomId}
        parentId={createParent ?? null}
        onOpenChange={(open) => !open && setCreateParent(undefined)}
      />
      <RenameFileDialog file={renamingFile} onClose={() => setRenamingFile(null)} />
      <ShareFileDialog file={sharingFile} onClose={() => setSharingFile(null)} />
      <PdfViewerModal file={viewingFile} onClose={() => setViewingFile(null)} />
    </section>
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
  dataroomId: string
  folderId: string | null
  subfolders: Folder[]
  files: FileRecord[]
  uploadRows: React.ReactNode
  onSelectFolder: (id: string) => void
  onCreateFolder: () => void
  onUpload: () => void
  onRenameFile: (f: FileRecord) => void
  onShareFile: (f: FileRecord) => void
  onDeleteFile: (f: FileRecord) => void
  onOpenFile: (f: FileRecord) => void
}

function FolderPaneContent({
  dataroomId,
  folderId,
  subfolders,
  files,
  uploadRows,
  onSelectFolder,
  onCreateFolder,
  onUpload,
  onRenameFile,
  onShareFile,
  onDeleteFile,
  onOpenFile,
}: FolderPaneContentProps) {
  const hasUploads = !!uploadRows
  const isEmpty = subfolders.length === 0 && files.length === 0 && !hasUploads

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
      {uploadRows}
      {subfolders.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Folders
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {subfolders.map((f) => (
              <FolderCard
                key={f.id}
                folder={f}
                dataroomId={dataroomId}
                onSelect={() => onSelectFolder(f.id)}
              />
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
            onShare={onShareFile}
            onDelete={onDeleteFile}
          />
        </section>
      )}
    </div>
  )
}

interface FolderCardProps {
  folder: Folder
  dataroomId: string
  onSelect: () => void
}

function FolderCard({ folder, dataroomId, onSelect }: FolderCardProps) {
  const isOptimistic = folder.id.startsWith('temp-')
  const dragData: FolderDragData = {
    kind: 'folder',
    id: folder.id,
    name: folder.name,
    dataroomId,
    parentId: folder.parentId,
  }
  const dropData: FolderDropData = {
    kind: 'folder',
    folderId: folder.id,
    dataroomId,
  }
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `folder:${folder.id}`,
    data: dragData,
    disabled: isOptimistic,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `folder-drop:${folder.id}`,
    data: dropData,
    disabled: isOptimistic,
  })

  const setRef = (node: HTMLElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }

  return (
    <button
      ref={setRef}
      type="button"
      onClick={onSelect}
      disabled={isOptimistic}
      {...listeners}
      {...attributes}
      className={cn(
        'flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary/60 hover:shadow-sm cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-40',
        isOver && 'border-primary ring-2 ring-primary/30',
      )}
    >
      <div className="rounded-lg bg-primary/10 p-2 text-primary">
        <FolderPlus className="h-5 w-5" aria-hidden />
      </div>
      <div className="w-full">
        <h4 className="line-clamp-2 text-sm font-medium">{folder.name}</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {(folder.childFolderCount ?? 0) + (folder.fileCount ?? 0)} items
        </p>
      </div>
    </button>
  )
}
