import type { Dataroom } from '@dataroom/shared'
import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useDeleteDataroom } from '../model/use-delete-dataroom'

interface DeleteDataroomDialogProps {
  dataroom: Dataroom | null
  onClose: () => void
}

export function DeleteDataroomDialog({ dataroom, onClose }: DeleteDataroomDialogProps) {
  const [typed, setTyped] = useState('')
  const remove = useDeleteDataroom()

  useEffect(() => {
    if (!dataroom) setTyped('')
  }, [dataroom])

  const canDelete = dataroom !== null && typed.trim() === dataroom.name && !remove.isPending

  const onConfirm = async () => {
    if (!dataroom) return
    await remove.mutateAsync({ id: dataroom.id, name: dataroom.name })
    onClose()
  }

  return (
    <Dialog open={!!dataroom} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete dataroom?</DialogTitle>
          <DialogDescription>
            This moves <span className="font-medium">{dataroom?.name}</span> and everything inside
            it to Trash. You can restore it from Trash before it is permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-4">
          <Label htmlFor="confirm-name">
            Type <span className="font-mono">{dataroom?.name}</span> to confirm
          </Label>
          <Input
            id="confirm-name"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!canDelete} onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
