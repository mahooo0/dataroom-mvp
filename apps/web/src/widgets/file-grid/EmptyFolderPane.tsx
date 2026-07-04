import { FolderPlus, Upload } from 'lucide-react'
import { RippleButton, RippleButtonRipples } from '@/shared/ui/animate-ui/components/buttons/ripple'

interface EmptyFolderPaneProps {
  canUpload: boolean
  onCreateFolder: () => void
  onUpload: () => void
}

export function EmptyFolderPane({ canUpload, onCreateFolder, onUpload }: EmptyFolderPaneProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-card/40 px-6 py-16 text-center">
      <div className="rounded-full bg-muted p-3 text-muted-foreground">
        <FolderPlus className="h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-medium">
          {canUpload ? 'This folder is empty' : 'Nothing here yet'}
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          {canUpload
            ? 'Drop a PDF anywhere in this pane, or use the buttons below.'
            : 'Create a folder to start organizing files.'}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <RippleButton variant="outline" onClick={onCreateFolder}>
          <FolderPlus className="mr-2 h-4 w-4" aria-hidden />
          New folder
          <RippleButtonRipples />
        </RippleButton>
        {canUpload && (
          <RippleButton onClick={onUpload}>
            <Upload className="mr-2 h-4 w-4" aria-hidden />
            Upload PDF
            <RippleButtonRipples />
          </RippleButton>
        )}
      </div>
    </div>
  )
}
