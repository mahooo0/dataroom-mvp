import type { Dataroom } from '@dataroom/shared'
import { AlertCircle, Plus, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DATAROOM_ICONS, useDatarooms } from '@/entities/dataroom'
import { CreateDataroomDialog } from '@/features/create-dataroom'
import { DeleteDataroomDialog } from '@/features/delete-dataroom'
import { QuickUploadButton, QuickUploadDropZone } from '@/features/quick-upload'
import { RenameDataroomDialog } from '@/features/rename-dataroom'
import { useIconFilterStore } from '@/features/search'
import { RippleButton, RippleButtonRipples } from '@/shared/ui/animate-ui/components/buttons/ripple'
import { Button } from '@/shared/ui/button'
import { DataroomsGrid } from '@/widgets/datarooms-list/DataroomsGrid'
import { DataroomsListSkeleton } from '@/widgets/datarooms-list/DataroomsListSkeleton'
import { EmptyDatarooms } from '@/widgets/datarooms-list/EmptyDatarooms'

export function DataroomsListPage() {
  const { data: datarooms, isLoading, isError, refetch } = useDatarooms()
  const iconKey = useIconFilterStore((s) => s.iconKey)
  const filtered = useMemo(() => {
    if (!iconKey) return datarooms
    return datarooms?.filter((d) => d.iconKey === iconKey)
  }, [datarooms, iconKey])
  const activeIcon = iconKey ? DATAROOM_ICONS.find((i) => i.key === iconKey) : null
  const [createOpen, setCreateOpen] = useState(false)
  const [renaming, setRenaming] = useState<Dataroom | null>(null)
  const [deleting, setDeleting] = useState<Dataroom | null>(null)

  return (
    <QuickUploadDropZone className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-2xl">Datarooms</h1>
          <p className="text-sm text-muted-foreground">
            Organize your due-diligence documents into secure repositories.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <QuickUploadButton className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium transition hover:bg-muted">
            <Upload className="h-4 w-4" aria-hidden />
            Upload PDF
          </QuickUploadButton>
          <RippleButton onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            New dataroom
            <RippleButtonRipples />
          </RippleButton>
        </div>
      </header>

      {isLoading ? (
        <DataroomsListSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center">
          <div className="rounded-full bg-destructive/10 p-3 text-destructive">
            <AlertCircle className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <h2 className="font-medium">Couldn&apos;t load your datarooms</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Check your connection and try again.
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : !datarooms || datarooms.length === 0 ? (
        <EmptyDatarooms onCreate={() => setCreateOpen(true)} />
      ) : !filtered || filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center text-sm text-muted-foreground">
          No datarooms match the {activeIcon?.label ?? 'current'} filter.
        </div>
      ) : (
        <DataroomsGrid
          datarooms={filtered}
          onRename={(dr) => setRenaming(dr)}
          onDelete={(dr) => setDeleting(dr)}
        />
      )}

      <CreateDataroomDialog open={createOpen} onOpenChange={setCreateOpen} />
      <RenameDataroomDialog dataroom={renaming} onClose={() => setRenaming(null)} />
      <DeleteDataroomDialog dataroom={deleting} onClose={() => setDeleting(null)} />
    </QuickUploadDropZone>
  )
}
