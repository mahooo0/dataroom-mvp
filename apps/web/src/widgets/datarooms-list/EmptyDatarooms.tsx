import { FolderOpen, Plus } from 'lucide-react'
import { RippleButton, RippleButtonRipples } from '@/shared/ui/animate-ui/components/buttons/ripple'

interface EmptyDataroomsProps {
  onCreate: () => void
}

export function EmptyDatarooms({ onCreate }: EmptyDataroomsProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card/50 px-6 py-24 text-center">
      <div className="rounded-full bg-muted p-4 text-muted-foreground">
        <FolderOpen className="h-8 w-8" aria-hidden />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-medium">No datarooms yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create your first dataroom to start uploading PDFs and organizing them into folders.
        </p>
      </div>
      <RippleButton onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" aria-hidden />
        New dataroom
        <RippleButtonRipples />
      </RippleButton>
    </div>
  )
}
