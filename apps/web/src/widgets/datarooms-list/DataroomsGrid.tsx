import type { Dataroom } from '@dataroom/shared'
import { DataroomCard } from './DataroomCard'

interface DataroomsGridProps {
  datarooms: Dataroom[]
  onRename: (dr: Dataroom) => void
  onDelete: (dr: Dataroom) => void
  onShare: (dr: Dataroom) => void
}

export function DataroomsGrid({ datarooms, onRename, onDelete, onShare }: DataroomsGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {datarooms.map((d) => (
        <DataroomCard
          key={d.id}
          dataroom={d}
          onRename={onRename}
          onDelete={onDelete}
          onShare={onShare}
        />
      ))}
    </div>
  )
}
