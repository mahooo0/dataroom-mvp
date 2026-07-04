import { AlertCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import '@/features/view-pdf/lib/pdf-worker'
import { BrandMark } from '@/shared/ui/brand-mark'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { usePublicShare } from './model/use-public-share'

interface PublicSharePageProps {
  token: string
}

const OPTIONS = { cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.296/cmaps/', cMapPacked: true }

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PublicSharePage({ token }: PublicSharePageProps) {
  const { data, isLoading, isError } = usePublicShare(token)
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

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

  const pageWidth = useMemo(() => Math.min(containerWidth - 32, 1000), [containerWidth])

  const downloadFile = useCallback(() => {
    if (!data?.downloadUrl) return
    const a = document.createElement('a')
    a.href = data.downloadUrl
    a.download = data.file.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }, [data])

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-3 p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-[80vh] w-full rounded-lg" />
      </div>
    )
  }
  if (isError || !data) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="rounded-full bg-destructive/10 p-3 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">This link is no longer available</h1>
        <p className="text-sm text-muted-foreground">
          The owner may have revoked access, or the file was deleted.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-[linear-gradient(to_bottom_right,rgba(137,190,255,0.35),rgba(137,190,255,0.95))] ring-1 ring-[#89BEFF]/40">
          <BrandMark className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-medium">{data.file.name}</h1>
          <p className="text-xs text-muted-foreground">
            {formatSize(data.file.sizeBytes)} · Read only
          </p>
        </div>
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
        <Button variant="outline" size="icon" onClick={downloadFile} aria-label="Download">
          <Download className="h-4 w-4" />
        </Button>
      </header>

      <div ref={containerRef} className="flex-1 overflow-auto bg-muted/40 p-4 pb-16 sm:pb-4">
        <div className="mx-auto flex justify-center">
          <Document
            file={data.downloadUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            options={OPTIONS}
            loading={
              <div className="mx-auto w-full max-w-[900px]">
                <Skeleton className="h-[80vh] w-full rounded-lg" />
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
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-lg"
            />
          </Document>
        </div>
      </div>

      <footer className="sticky bottom-0 flex items-center justify-center gap-3 border-t bg-background px-3 py-2 sm:hidden">
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
    </div>
  )
}
