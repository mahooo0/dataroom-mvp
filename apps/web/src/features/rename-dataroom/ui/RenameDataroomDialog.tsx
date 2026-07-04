import { type Dataroom, renameDataroomInput } from '@dataroom/shared'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { type DataroomIconKey, IconPicker } from '@/entities/dataroom'
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
  name?: string
  iconKey?: DataroomIconKey | null
}

export function RenameDataroomDialog({ dataroom, onClose }: RenameDataroomDialogProps) {
  const rename = useRenameDataroom()
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(renameDataroomInput),
    defaultValues: { name: dataroom?.name ?? '', iconKey: dataroom?.iconKey ?? null },
  })

  useEffect(() => {
    if (dataroom) {
      reset({ name: dataroom.name, iconKey: dataroom.iconKey ?? null })
      setTimeout(() => setFocus('name'), 0)
    }
  }, [dataroom, reset, setFocus])

  const onSubmit = handleSubmit(async (data) => {
    if (!dataroom) return
    await rename.mutateAsync({ id: dataroom.id, name: data.name, iconKey: data.iconKey })
    onClose()
  })

  return (
    <Dialog open={!!dataroom} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Rename dataroom</DialogTitle>
            <DialogDescription>Change the name or pick a different icon.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rename-dataroom">Name</Label>
              <Input id="rename-dataroom" autoComplete="off" {...register('name')} />
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
