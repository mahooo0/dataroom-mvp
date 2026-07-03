import { createDataroomInput } from '@dataroom/shared'
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
import { useCreateDataroom } from '../model/use-create-dataroom'

interface CreateDataroomDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormData {
  name: string
}

export function CreateDataroomDialog({ open, onOpenChange }: CreateDataroomDialogProps) {
  const create = useCreateDataroom()
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createDataroomInput),
    defaultValues: { name: '' },
  })

  useEffect(() => {
    if (open) setTimeout(() => setFocus('name'), 0)
    else reset()
  }, [open, setFocus, reset])

  const onSubmit = handleSubmit(async (data) => {
    await create.mutateAsync(data)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New dataroom</DialogTitle>
            <DialogDescription>
              Give the dataroom a memorable name. You can change it later.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2 py-4">
            <Label htmlFor="dataroom-name">Name</Label>
            <Input
              id="dataroom-name"
              placeholder="Project Nightingale"
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
