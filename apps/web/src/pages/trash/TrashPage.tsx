import { Trash2 } from 'lucide-react'

export function TrashPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Trash</h1>
        <p className="text-sm text-muted-foreground">
          Deleted datarooms, folders and files. Items are permanently removed after 30 days.
        </p>
      </header>

      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/30 p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Trash2 className="size-6" />
        </div>
        <h2 className="font-medium">Trash is empty</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Deleted items will appear here. You can restore them with one click, or delete
          permanently.
        </p>
      </div>
    </div>
  )
}
