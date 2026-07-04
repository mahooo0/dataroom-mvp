import { type FileRecord, renameFileInput } from '@dataroom/shared'
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
import { useRenameFile } from '../model/use-rename-file'

interface RenameFileDialogProps {
  file: FileRecord | null
  onClose: () => void
}

interface FormData {
  name: string
}

function selectBasename(input: HTMLInputElement | null) {
  if (!input) return
  const value = input.value
  const dot = value.lastIndexOf('.')
  const end = dot > 0 ? dot : value.length
  input.setSelectionRange(0, end)
}

export function RenameFileDialog({ file, onClose }: RenameFileDialogProps) {
  const rename = useRenameFile()
  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(renameFileInput),
    defaultValues: { name: file?.name ?? '' },
  })

  useEffect(() => {
    if (file) {
      reset({ name: file.name })
      setTimeout(() => {
        setFocus('name')
        selectBasename(document.getElementById('rename-file') as HTMLInputElement)
      }, 0)
    }
  }, [file, reset, setFocus])

  const onSubmit = handleSubmit(async (data) => {
    if (!file) return
    const trimmed = data.name.trim()
    const withExt = trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`
    // Close the dialog optimistically so a 409 conflict modal doesn't stack
    // on top of this one. Rollback restores the file row on error.
    onClose()
    try {
      await rename.mutateAsync({ id: file.id, folderId: file.folderId, name: withExt })
    } catch {
      // handled by the mutation's onError (toast or conflict modal)
    }
  })

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
            <DialogDescription>Extension is preserved automatically.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="rename-file">Name</Label>
            <Input id="rename-file" autoComplete="off" {...register('name')} />
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
