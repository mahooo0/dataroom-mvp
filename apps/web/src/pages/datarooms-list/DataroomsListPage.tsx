import { FolderPlus } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { EmptyDatarooms } from '@/widgets/datarooms-list/EmptyDatarooms'

export function DataroomsListPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Datarooms</h1>
          <p className="text-sm text-muted-foreground">
            Organize your due-diligence documents into secure repositories.
          </p>
        </div>
        <Button disabled title="Coming in Phase 2">
          <FolderPlus className="mr-2 h-4 w-4" aria-hidden />
          New dataroom
        </Button>
      </header>

      <EmptyDatarooms />
    </div>
  )
}
