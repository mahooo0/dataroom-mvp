import { AlertCircle, FileText, RefreshCw, X } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import type { UploadSession } from '../model/upload-store'
import { useUploadFile } from '../model/use-upload-file'

interface UploadingRowProps {
  session: UploadSession
}

export function UploadingRow({ session }: UploadingRowProps) {
  const { retry, cancel } = useUploadFile()
  const percent = Math.round(session.progress * 100)
  const isError = session.state === 'error'

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted p-2 text-muted-foreground">
          <FileText className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-medium">{session.name}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isError ? (
              <span className="flex items-center gap-1 text-destructive">
                <AlertCircle className="h-3 w-3" aria-hidden />
                {session.error ?? 'Upload failed'}
              </span>
            ) : (
              `Uploading… ${percent}%`
            )}
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={
                isError ? 'h-full w-full bg-destructive' : 'h-full bg-primary transition-[width]'
              }
              style={{ width: isError ? '100%' : `${percent}%` }}
            />
          </div>
        </div>
        <div className="flex gap-1">
          {isError && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => retry(session.id)}
              aria-label="Retry upload"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => cancel(session.id)}
            aria-label={isError ? 'Dismiss' : 'Cancel upload'}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
