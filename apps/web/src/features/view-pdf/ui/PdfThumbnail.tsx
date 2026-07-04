import { FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import { cn } from '@/shared/lib/utils'
import { useDownloadUrl } from '../model/use-download-url'
import '../lib/pdf-worker'

interface PdfThumbnailProps {
  fileId: string
  className?: string
  width?: number
}

const OPTIONS = { cMapUrl: 'https://unpkg.com/pdfjs-dist@5.4.296/cmaps/', cMapPacked: true }

/**
 * Lazy first-page preview for a PDF file. Only requests the presigned URL and
 * spins up pdf.js once the card enters the viewport (± 200px). Falls back to
 * a file glyph on load failure so a broken PDF doesn't blank the tile.
 */
export function PdfThumbnail({ fileId, className, width = 220 }: PdfThumbnailProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [errored, setErrored] = useState(false)
  const { data, refetch } = useDownloadUrl(inView ? fileId : null)
  const retriedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true)
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [inView])

  const onLoadError = (err: unknown) => {
    const message = err instanceof Error ? err.message.toLowerCase() : ''
    // Presigned URL expired: refetch once and retry rendering. If it fails again,
    // fall through to the glyph fallback so the tile isn't blank.
    if (!retriedRef.current && (message.includes('403') || message.includes('unauthorized'))) {
      retriedRef.current = true
      void refetch()
      return
    }
    setErrored(true)
  }

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-muted/60 ring-1 ring-inset ring-border/40',
        className,
      )}
    >
      {data && !errored ? (
        <Document
          key={data.url}
          file={data.url}
          onLoadError={onLoadError}
          options={OPTIONS}
          loading={<PdfFallback />}
          error={<PdfFallback />}
        >
          <Page
            pageNumber={1}
            width={width}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="pointer-events-none"
          />
        </Document>
      ) : (
        <PdfFallback />
      )}
    </div>
  )
}

function PdfFallback() {
  return (
    <div className="flex flex-col items-center gap-1 text-red-600/70 dark:text-red-400/70">
      <FileText className="h-8 w-8" />
      <span className="text-[10px] font-semibold uppercase tracking-wider">PDF</span>
    </div>
  )
}
