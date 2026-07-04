import type { FileRecord } from '@dataroom/shared'
import { ChevronLeft, ChevronRight, Download, Loader2, Minus, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import '../lib/pdf-worker'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent } from '@/shared/ui/dialog'
import { useDownloadUrl } from '../model/use-download-url'

interface PdfViewerModalProps {
  file: FileRecord | null
  onClose: () => void
}

type ZoomMode = 'fit-width' | 'fit-page' | number

const OPTIONS = { cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.296/cmaps/', cMapPacked: true }

export function PdfViewerModal({ file, onClose }: PdfViewerModalProps) {
  const { data: url, refetch, isLoading } = useDownloadUrl(file?.id ?? null)
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const [zoom, setZoom] = useState<ZoomMode>('fit-width')
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  useEffect(() => {
    if (file) {
      setPageNumber(1)
      setZoom('fit-width')
    }
  }, [file])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setContainerWidth(entry.contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => setNumPages(total),
    [],
  )

  const onLoadError = useCallback(
    (err: unknown) => {
      const message = err instanceof Error ? err.message.toLowerCase() : ''
      if (message.includes('403') || message.includes('unauthorized')) {
        void refetch()
      }
    },
    [refetch],
  )

  const pageWidth = useMemo(() => {
    if (zoom === 'fit-width') return Math.min(containerWidth - 32, 1200)
    if (zoom === 'fit-page') return undefined
    return undefined
  }, [zoom, containerWidth])

  const scale = typeof zoom === 'number' ? zoom : undefined

  const downloadFile = useCallback(async () => {
    if (!url?.url || !file) return
    const a = document.createElement('a')
    a.href = url.url
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }, [file, url?.url])

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex h-[92vh] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-[95vw]"
        showCloseButton={false}
      >
        <header className="flex items-center justify-between gap-4 border-b bg-background px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate text-sm font-medium">{file?.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border bg-muted/40 px-1 py-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[3.5rem] text-center text-xs tabular-nums">
                {pageNumber} / {numPages || '—'}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 rounded-md border bg-muted/40 px-1 py-0.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() =>
                  setZoom((z) => {
                    const current = typeof z === 'number' ? z : 1
                    return Math.max(0.5, current - 0.25)
                  })
                }
                aria-label="Zoom out"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <button
                type="button"
                onClick={() => setZoom('fit-width')}
                className={cn(
                  'rounded px-2 text-xs',
                  zoom === 'fit-width' ? 'bg-background' : 'text-muted-foreground',
                )}
              >
                Fit width
              </button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() =>
                  setZoom((z) => {
                    const current = typeof z === 'number' ? z : 1
                    return Math.min(2, current + 0.25)
                  })
                }
                aria-label="Zoom in"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={downloadFile}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div ref={containerRef} className="relative flex-1 overflow-auto bg-muted/40 p-4">
          {isLoading || !url ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="mx-auto flex justify-center">
              <Document
                file={url.url}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onLoadError}
                options={OPTIONS}
                loading={
                  <div className="flex h-96 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                }
                error={
                  <div className="rounded-xl border border-dashed p-8 text-center text-sm text-destructive">
                    Couldn&apos;t render this PDF.
                  </div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  width={pageWidth}
                  scale={scale}
                  renderTextLayer
                  renderAnnotationLayer={false}
                  className="shadow-lg"
                />
              </Document>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
