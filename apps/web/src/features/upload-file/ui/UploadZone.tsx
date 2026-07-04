import { ACCEPTED_MIME } from '@dataroom/shared'
import { Upload } from 'lucide-react'
import { type ReactNode, useCallback, useRef, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useUploadFile } from '../model/use-upload-file'

interface UploadZoneProps {
  folderId: string
  children: ReactNode
  className?: string
}

export function UploadZone({ folderId, children, className }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const { enqueue } = useUploadFile()

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      const files = Array.from(event.dataTransfer.files)
      if (files.length > 0) enqueue(files, folderId)
    },
    [enqueue, folderId],
  )

  const onDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }, [])

  const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragging(false)
    }
  }, [])

  const onFilesPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return
    enqueue(Array.from(event.target.files), folderId)
    event.target.value = ''
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target — files come from OS drag, no keyboard equivalent needed
    <div
      onDrop={onDrop}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      className={cn('relative rounded-xl transition', className)}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_MIME}
        onChange={onFilesPicked}
        className="hidden"
      />
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-8 w-8" aria-hidden />
            <p className="text-sm font-medium">Drop PDFs to upload</p>
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

interface UploadTriggerProps {
  folderId: string
  disabled?: boolean
  label?: string
}

export function UploadTrigger({ folderId, disabled, label = 'Upload' }: UploadTriggerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { enqueue } = useUploadFile()

  const onFilesPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return
    enqueue(Array.from(event.target.files), folderId)
    event.target.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_MIME}
        onChange={onFilesPicked}
        className="hidden"
      />
      <Button onClick={() => inputRef.current?.click()} disabled={disabled}>
        <Upload className="mr-2 h-4 w-4" aria-hidden />
        {label}
      </Button>
    </>
  )
}
