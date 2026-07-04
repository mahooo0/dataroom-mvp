import { type Folder, renameFolderInput } from '@dataroom/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
import { useRenameFolder } from '../model/use-rename-folder'

interface RenameFolderDialogProps {
  folder: Folder | null
  onClose: () => void
}

interface FormData {
  name: string
}

export function RenameFolderDialog({ folder, onClose }: RenameFolderDialogProps) {
  const rename = useRenameFolder()
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(renameFolderInput),
    defaultValues: { name: folder?.name ?? '' },
  })

  useEffect(() => {
    if (folder) {
      reset({ name: folder.name })
      setTimeout(() => setFocus('name'), 0)
    }
  }, [folder, reset, setFocus])

  const onSubmit = handleSubmit(async (data) => {
    if (!folder) return
    await rename.mutateAsync({ id: folder.id, dataroomId: folder.dataroomId, name: data.name })
    onClose()
  })

  return (
    <Dialog open={!!folder} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>Pick a new name for this folder.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="rename-folder">Name</Label>
            <Input id="rename-folder" autoComplete="off" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
