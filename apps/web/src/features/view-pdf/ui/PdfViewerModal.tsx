import type { FileRecord } from '@dataroom/shared'
import { ChevronLeft, ChevronRight, Download, Loader2, Minus, Plus, Share2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import '../lib/pdf-worker'
import { ShareFileDialog } from '@/features/share-file'
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
  const [shareOpen, setShareOpen] = useState(false)
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
        className="flex h-[100dvh] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:h-[92vh] sm:max-w-[95vw]"
        showCloseButton={false}
      >
        <header className="flex items-center gap-2 border-b bg-background px-3 py-2 sm:px-4 sm:py-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
          <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{file?.name}</h2>

          <div className="hidden items-center gap-1 rounded-md border bg-muted/40 px-1 py-0.5 sm:flex">
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

          <div className="hidden items-center gap-1 rounded-md border bg-muted/40 px-1 py-0.5 sm:flex">
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

          <Button
            variant="outline"
            size="icon"
            onClick={() => setShareOpen(true)}
            aria-label="Share"
            className="shrink-0"
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={downloadFile}
            aria-label="Download"
            className="shrink-0 sm:hidden"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadFile}
            className="hidden sm:inline-flex"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </header>

        <div
          ref={containerRef}
          className="relative flex-1 overflow-auto bg-muted/40 p-4 pb-16 sm:pb-4"
        >
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

        <footer className="flex items-center justify-center gap-3 border-t bg-background px-3 py-2 sm:hidden">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="min-w-[4rem] text-center text-sm tabular-nums">
            {pageNumber} / {numPages || '—'}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </footer>
        <ShareFileDialog file={shareOpen ? file : null} onClose={() => setShareOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
