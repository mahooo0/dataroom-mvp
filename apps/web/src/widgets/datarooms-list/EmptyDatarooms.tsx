import { FolderOpen } from 'lucide-react'

export function EmptyDatarooms() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed bg-card/50 px-6 py-24 text-center">
      <div className="rounded-full bg-muted p-4 text-muted-foreground">
        <FolderOpen className="h-8 w-8" aria-hidden />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-medium">No datarooms yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Once you create your first dataroom, you&apos;ll be able to upload PDF documents and
          organize them into folders.
        </p>
      </div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground/70">
        Create button ships in the next phase
      </p>
    </div>
  )
}
