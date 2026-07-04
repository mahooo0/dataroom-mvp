import type { PublicFile, PublicFolder } from '@dataroom/shared'
import { AlertCircle, ChevronRight, FileText, Folder as FolderIcon, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataroomOrb } from '@/entities/dataroom'
import { BrandMark } from '@/shared/ui/brand-mark'
import { usePublicShare } from './model/use-public-share'
import { PublicPdfViewerModal } from './ui/PublicPdfViewerModal'

interface PublicSharePageProps {
  token: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PublicSharePage({ token }: PublicSharePageProps) {
  const { data, isLoading, isError } = usePublicShare(token)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [viewingFile, setViewingFile] = useState<PublicFile | null>(null)

  const folderById = useMemo(() => {
    const map = new Map<string, PublicFolder>()
    data?.folders.forEach((f) => {
      map.set(f.id, f)
    })
    return map
  }, [data?.folders])

  const currentSubfolders = useMemo(
    () => (data ? data.folders.filter((f) => f.parentId === folderId) : []),
    [data, folderId],
  )
  const currentFiles = useMemo(
    () =>
      data
        ? data.files.filter((f) =>
            folderId === null ? isFileInRoot(f, folderById) : f.folderId === folderId,
          )
        : [],
    [data, folderId, folderById],
  )

  const breadcrumbs = useMemo(() => {
    const trail: PublicFolder[] = []
    let cur = folderId ? folderById.get(folderId) : null
    while (cur) {
      trail.unshift(cur)
      cur = cur.parentId ? folderById.get(cur.parentId) : null
    }
    return trail
  }, [folderId, folderById])

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
          The owner may have revoked access, or the dataroom was deleted.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex size-8 items-center justify-center overflow-hidden rounded-lg bg-[linear-gradient(to_bottom_right,rgba(137,190,255,0.35),rgba(137,190,255,0.95))] ring-1 ring-[#89BEFF]/40">
          <BrandMark className="size-4" />
        </div>
        <span className="text-sm text-muted-foreground">Dataroom</span>
        <span className="text-muted-foreground/50">/</span>
        <DataroomOrb id={data.dataroom.id} iconKey={data.dataroom.iconKey ?? null} size={20} />
        <h1 className="min-w-0 truncate text-sm font-medium">{data.dataroom.name}</h1>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Read only
        </span>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => setFolderId(null)}
            className="rounded px-1.5 py-0.5 hover:bg-muted"
          >
            Root
          </button>
          {breadcrumbs.map((crumb) => (
            <div key={crumb.id} className="contents">
              <ChevronRight className="h-3 w-3" />
              <button
                type="button"
                onClick={() => setFolderId(crumb.id)}
                className="max-w-[10rem] truncate rounded px-1.5 py-0.5 hover:bg-muted"
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </nav>

        {currentSubfolders.length === 0 && currentFiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card/40 px-6 py-16 text-center text-sm text-muted-foreground">
            This folder is empty.
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {currentSubfolders.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Folders
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {currentSubfolders.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFolderId(f.id)}
                      className="flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left transition hover:border-primary/60 hover:shadow-sm"
                    >
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <FolderIcon className="h-5 w-5" />
                      </div>
                      <h4 className="line-clamp-2 text-sm font-medium">{f.name}</h4>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {currentFiles.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Files
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {currentFiles.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setViewingFile(file)}
                      className="flex flex-col items-start gap-3 overflow-hidden rounded-xl border bg-card p-4 text-left transition hover:border-primary/60 hover:shadow-sm"
                    >
                      <div className="rounded-lg bg-red-500/10 p-2 text-red-600 dark:text-red-400">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="w-full">
                        <h4 className="line-clamp-2 text-sm font-medium">{file.name}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatSize(file.sizeBytes)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      <PublicPdfViewerModal token={token} file={viewingFile} onClose={() => setViewingFile(null)} />
    </div>
  )
}

function isFileInRoot(f: PublicFile, folderById: Map<string, PublicFolder>): boolean {
  const folder = folderById.get(f.folderId)
  return folder?.parentId === null
}
