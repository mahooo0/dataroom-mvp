import type { Folder } from '@dataroom/shared'
import { AlertTriangle } from 'lucide-react'
import { useFolderDescendantCounts } from '@/entities/folder'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { useDeleteFolder } from '../model/use-delete-folder'

interface DeleteFolderDialogProps {
  folder: Folder | null
  onClose: () => void
}

export function DeleteFolderDialog({ folder, onClose }: DeleteFolderDialogProps) {
  const remove = useDeleteFolder()
  const counts = useFolderDescendantCounts(folder?.id ?? null)

  const onConfirm = async () => {
    if (!folder) return
    await remove.mutateAsync({
      id: folder.id,
      dataroomId: folder.dataroomId,
      name: folder.name,
    })
    onClose()
  }

  const childFolders = counts.data?.folderCount ?? folder?.childFolderCount ?? 0
  const files = counts.data?.fileCount ?? folder?.fileCount ?? 0
  const total = childFolders + files

  return (
    <Dialog open={!!folder} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            Delete folder?
          </DialogTitle>
          <DialogDescription>
            <span>
              This moves <span className="font-medium">{folder?.name}</span>
              {total > 0 && (
                <>
                  {' '}
                  and everything inside it — {files} file{files === 1 ? '' : 's'} and {childFolders}{' '}
                  folder{childFolders === 1 ? '' : 's'}
                </>
              )}{' '}
              to Trash. You can restore it from Trash before permanent deletion.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={remove.isPending}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
