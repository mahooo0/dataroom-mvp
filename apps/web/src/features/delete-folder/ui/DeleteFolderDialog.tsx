import type { Folder } from '@dataroom/shared'
import { AlertTriangle } from 'lucide-react'
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

  const onConfirm = async () => {
    if (!folder) return
    await remove.mutateAsync({
      id: folder.id,
      dataroomId: folder.dataroomId,
      name: folder.name,
    })
    onClose()
  }

  const childFolders = folder?.childFolderCount ?? 0
  const files = folder?.fileCount ?? 0

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
              {childFolders + files > 0 && (
                <>
                  {' '}
                  and its {files} file{files === 1 ? '' : 's'} and {childFolders} folder
                  {childFolders === 1 ? '' : 's'}
                </>
              )}{' '}
              to Trash. You can restore it before it&apos;s permanently deleted.
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
