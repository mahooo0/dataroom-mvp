import { createDataroomInput } from '@dataroom/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import type { DataroomIconKey } from '@/entities/dataroom'
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
import { IconPicker } from './IconPicker'

interface CreateDataroomDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormData {
  name: string
  iconKey: DataroomIconKey | null
}

const DEFAULT_ICON: DataroomIconKey = 'orb-1'

export function CreateDataroomDialog({ open, onOpenChange }: CreateDataroomDialogProps) {
  const create = useCreateDataroom()
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createDataroomInput),
    defaultValues: { name: '', iconKey: DEFAULT_ICON },
  })

  useEffect(() => {
    if (open) setTimeout(() => setFocus('name'), 0)
    else reset({ name: '', iconKey: DEFAULT_ICON })
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
              Give the dataroom a memorable name and pick an icon.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
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

            <div className="grid gap-2">
              <Label>Icon</Label>
              <Controller
                control={control}
                name="iconKey"
                render={({ field }) => (
                  <IconPicker
                    value={field.value ?? null}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
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
