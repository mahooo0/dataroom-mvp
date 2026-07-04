import { Check, Filter, X } from 'lucide-react'
import { DATAROOM_ICONS, DataroomOrb } from '@/entities/dataroom'
import { useIconFilterStore } from '@/features/search'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

export function IconFilter() {
  const iconKey = useIconFilterStore((s) => s.iconKey)
  const setIconKey = useIconFilterStore((s) => s.setIconKey)
  const active = iconKey !== null
  const activeIcon = active ? DATAROOM_ICONS.find((i) => i.key === iconKey) : null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-9 gap-2 rounded-lg px-2.5', active && 'border-primary/40 bg-primary/5')}
        >
          {activeIcon ? (
            <DataroomOrb id={activeIcon.key} iconKey={activeIcon.key} size={16} />
          ) : (
            <Filter className="size-4" />
          )}
          <span className="hidden text-sm md:inline">
            {activeIcon ? activeIcon.label : 'Filter'}
          </span>
          {active ? (
            <button
              type="button"
              aria-label="Clear filter"
              className="ml-0.5 rounded hover:bg-accent"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                setIconKey(null)
              }}
            >
              <X className="size-3" />
            </button>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Filter by icon
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setIconKey(null)} className="gap-2">
          <div className="flex h-4 w-4 items-center justify-center">
            {iconKey === null ? <Check className="h-3.5 w-3.5" /> : null}
          </div>
          <span>All</span>
        </DropdownMenuItem>
        {DATAROOM_ICONS.map((icon) => (
          <DropdownMenuItem key={icon.key} onSelect={() => setIconKey(icon.key)} className="gap-2">
            <div className="flex h-4 w-4 items-center justify-center">
              {iconKey === icon.key ? <Check className="h-3.5 w-3.5" /> : null}
            </div>
            <DataroomOrb id={icon.key} iconKey={icon.key} size={16} />
            <span>{icon.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
