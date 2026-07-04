import { createFolderInput } from '@dataroom/shared'
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
import { useCreateFolder } from '../model/use-create-folder'

interface CreateFolderDialogProps {
  open: boolean
  dataroomId: string
  parentId: string | null
  onOpenChange: (open: boolean) => void
}

interface FormData {
  name: string
}

export function CreateFolderDialog({
  open,
  dataroomId,
  parentId,
  onOpenChange,
}: CreateFolderDialogProps) {
  const create = useCreateFolder()
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createFolderInput.pick({ name: true })),
    defaultValues: { name: '' },
  })

  useEffect(() => {
    if (open) setTimeout(() => setFocus('name'), 0)
    else reset()
  }, [open, setFocus, reset])

  const onSubmit = handleSubmit(async (data) => {
    onOpenChange(false)
    try {
      await create.mutateAsync({ dataroomId, parentId, name: data.name })
    } catch {
      // handled by mutation onError (toast or conflict modal)
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              {parentId
                ? 'Create a folder inside this location.'
                : 'Create a folder in the dataroom root.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              placeholder="Q3 Financials"
              autoComplete="off"
              disabled={isSubmitting}
              {...register('name')}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
