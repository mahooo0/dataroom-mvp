import { Loader2 } from 'lucide-react'
import { useDatarooms } from '@/entities/dataroom'

interface DataroomDetailPageProps {
  dataroomId: string
}

export function DataroomDetailPage({ dataroomId }: DataroomDetailPageProps) {
  const { data: datarooms, isLoading } = useDatarooms()
  const dataroom = datarooms?.find((d) => d.id === dataroomId)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!dataroom) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-lg font-medium">Dataroom not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been deleted or you may not have access.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{dataroom.name}</h1>
        <p className="text-sm text-muted-foreground">Folders and files will appear here.</p>
      </header>
      <div className="rounded-xl border border-dashed bg-card/40 px-6 py-16 text-center text-sm text-muted-foreground">
        Folder tree and file grid coming next.
      </div>
    </div>
  )
}
