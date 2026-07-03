import { type Dataroom, renameDataroomInput } from '@dataroom/shared'
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
import { useRenameDataroom } from '../model/use-rename-dataroom'

interface RenameDataroomDialogProps {
  dataroom: Dataroom | null
  onClose: () => void
}

interface FormData {
  name: string
}

export function RenameDataroomDialog({ dataroom, onClose }: RenameDataroomDialogProps) {
  const rename = useRenameDataroom()
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(renameDataroomInput),
    defaultValues: { name: dataroom?.name ?? '' },
  })

  useEffect(() => {
    if (dataroom) {
      reset({ name: dataroom.name })
      setTimeout(() => setFocus('name'), 0)
    }
  }, [dataroom, reset, setFocus])

  const onSubmit = handleSubmit(async (data) => {
    if (!dataroom) return
    await rename.mutateAsync({ id: dataroom.id, name: data.name })
    onClose()
  })

  return (
    <Dialog open={!!dataroom} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Rename dataroom</DialogTitle>
            <DialogDescription>Pick a new name for this dataroom.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            <Label htmlFor="rename-dataroom">Name</Label>
            <Input id="rename-dataroom" autoComplete="off" {...register('name')} />
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
