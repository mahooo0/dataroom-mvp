import { FolderPlus, Upload } from 'lucide-react'
import { Button } from '@/shared/ui/button'

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
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCreateFolder}>
          <FolderPlus className="mr-2 h-4 w-4" aria-hidden />
          New folder
        </Button>
        {canUpload && (
          <Button onClick={onUpload}>
            <Upload className="mr-2 h-4 w-4" aria-hidden />
            Upload PDF
          </Button>
        )}
      </div>
    </div>
  )
}
