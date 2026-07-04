import type { FileRecord } from '@dataroom/shared'
import { formatDistanceToNow } from 'date-fns'
import { FileText, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

interface FileGridProps {
  files: FileRecord[]
  onOpen: (file: FileRecord) => void
  onRename: (file: FileRecord) => void
  onDelete: (file: FileRecord) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileGrid({ files, onOpen, onRename, onDelete }: FileGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {files.map((file) => (
        <div
          key={file.id}
          className="group relative overflow-hidden rounded-xl border bg-card p-4 transition hover:border-primary/60 hover:shadow-sm"
        >
          <button
            type="button"
            onClick={() => onOpen(file)}
            className="flex w-full flex-col items-start gap-3 text-left"
          >
            <div className="rounded-lg bg-red-500/10 p-2 text-red-600 dark:text-red-400">
              <FileText className="h-5 w-5" aria-hidden />
            </div>
            <div className="w-full">
              <h4 className="line-clamp-2 text-sm font-medium">{file.name}</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatSize(file.sizeBytes)} •{' '}
                {formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true })}
              </p>
            </div>
          </button>
          <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Actions for ${file.name}`}
                  className="h-7 w-7"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onRename(file)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(file)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  )
}
