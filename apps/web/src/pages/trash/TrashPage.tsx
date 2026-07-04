import type { TrashItem } from '@dataroom/shared'
import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, FileText, Folder, RotateCcw, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { DataroomOrb } from '@/entities/dataroom'
import { useTrash } from '@/entities/trash'
import { usePermanentDelete } from '@/features/permanent-delete-trash'
import { useRestoreTrash } from '@/features/restore-trash'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function itemSubtitle(item: TrashItem): string {
  if (item.kind === 'dataroom') {
    const parts: string[] = []
    if (item.folderCount > 0)
      parts.push(`${item.folderCount} folder${item.folderCount === 1 ? '' : 's'}`)
    if (item.fileCount > 0) parts.push(`${item.fileCount} file${item.fileCount === 1 ? '' : 's'}`)
    return parts.length ? `Dataroom · ${parts.join(', ')}` : 'Dataroom'
  }
  if (item.kind === 'folder') {
    const parts: string[] = []
    if (item.folderCount > 0)
      parts.push(`${item.folderCount} subfolder${item.folderCount === 1 ? '' : 's'}`)
    if (item.fileCount > 0) parts.push(`${item.fileCount} file${item.fileCount === 1 ? '' : 's'}`)
    return `${item.dataroomName} · ${parts.length ? parts.join(', ') : 'empty'}`
  }
  return `${item.dataroomName} · ${item.folderName} · ${formatSize(item.sizeBytes)}`
}

function ItemIcon({ item }: { item: TrashItem }) {
  if (item.kind === 'dataroom') {
    return (
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted">
        {item.iconKey ? (
          <DataroomOrb id={item.id} iconKey={item.iconKey} size={28} />
        ) : (
          <Zap className="h-4 w-4" />
        )}
      </div>
    )
  }
  if (item.kind === 'folder') {
    return (
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
        <Folder className="h-5 w-5" />
      </div>
    )
  }
  return (
    <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground">
      <FileText className="h-5 w-5" />
    </div>
  )
}

export function TrashPage() {
  const { data: items, isLoading, isError, refetch } = useTrash()
  const restore = useRestoreTrash()
  const permanent = usePermanentDelete()
  const [confirming, setConfirming] = useState<TrashItem | null>(null)

  const restorePendingId =
    restore.isPending && restore.variables
      ? (restore.variables as { item: TrashItem }).item.id
      : null
  const deletePendingId =
    permanent.isPending && permanent.variables
      ? (permanent.variables as { item: TrashItem }).item.id
      : null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <Trash2 className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
          <p className="text-sm text-muted-foreground">Restore items or delete them permanently.</p>
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton set
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
          <p className="text-sm">Couldn&apos;t load Trash.</p>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : !items || items.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Trash2 className="h-5 w-5" aria-hidden />
          </div>
          <h3 className="text-base font-medium">Trash is empty</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Deleted datarooms, folders, and files land here.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((item) => {
            const rowBusy = restorePendingId === item.id || deletePendingId === item.id
            return (
              <li
                key={`${item.kind}:${item.id}`}
                className="flex items-center gap-3 px-3 py-3 sm:px-4"
              >
                <ItemIcon item={item} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {itemSubtitle(item)} · deleted{' '}
                    {formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restore.mutate({ item })}
                    disabled={rowBusy}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirming(item)}
                    disabled={rowBusy}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Delete
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{confirming?.name}</span> will be removed from the
              database and its files erased from storage. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming) permanent.mutate({ item: confirming })
                setConfirming(null)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
