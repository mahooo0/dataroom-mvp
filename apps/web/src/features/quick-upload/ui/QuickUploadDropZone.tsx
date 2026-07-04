import { ACCEPTED_MIME } from '@dataroom/shared'
import { useNavigate } from '@tanstack/react-router'
import { Upload } from 'lucide-react'
import { type ReactNode, useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useQuickUpload } from '../model/use-quick-upload'

interface QuickUploadDropZoneProps {
  children: ReactNode
  className?: string
}

/**
 * Wraps children so any PDF dropped anywhere inside the pane goes through
 * useQuickUpload — no need for the user to open a dataroom first. On success
 * we navigate them to the Inbox so uploads feel confirmed.
 */
export function QuickUploadDropZone({ children, className }: QuickUploadDropZoneProps) {
  const { upload } = useQuickUpload()
  const navigate = useNavigate()
  const dragDepth = useRef(0)
  const [dragging, setDragging] = useState(false)

  const handleFiles = useCallback(
    async (files: File[]) => {
      const target = await upload(files)
      if (target) {
        void navigate({
          to: '/datarooms/$dataroomId',
          params: { dataroomId: target.dataroomId },
          search: { folderId: target.folderId },
        })
      }
    },
    [navigate, upload],
  )

  const onDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
  }
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }
  const onDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer?.files?.length) return
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const all = Array.from(e.dataTransfer.files)
    const pdfs = all.filter((f) => f.type === ACCEPTED_MIME)
    const skipped = all.length - pdfs.length
    if (skipped > 0) {
      toast.warning(
        `Skipped ${skipped} non-PDF file${skipped === 1 ? '' : 's'} — only PDFs are supported.`,
      )
    }
    if (pdfs.length === 0) return
    void handleFiles(pdfs)
  }

  return (
    <section
      aria-label="Drop PDF files to upload"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn('relative', className)}
    >
      {children}
      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-background/95 px-8 py-6 text-center shadow-xl">
            <Upload className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">Drop PDFs to add them to your Inbox</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}

interface QuickUploadButtonProps {
  className?: string
  children?: ReactNode
}

/**
 * Trigger version — pops the native file picker without requiring a dataroom.
 */
export function QuickUploadButton({ className, children }: QuickUploadButtonProps) {
  const { upload } = useQuickUpload()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const onPicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return
    const files = Array.from(event.target.files)
    event.target.value = ''
    const target = await upload(files)
    if (target) {
      void navigate({
        to: '/datarooms/$dataroomId',
        params: { dataroomId: target.dataroomId },
        search: { folderId: target.folderId },
      })
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_MIME}
        onChange={onPicked}
        className="hidden"
      />
      <button type="button" onClick={() => inputRef.current?.click()} className={className}>
        {children}
      </button>
    </>
  )
}
