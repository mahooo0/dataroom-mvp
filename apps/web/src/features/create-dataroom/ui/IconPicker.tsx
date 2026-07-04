import { Check } from 'lucide-react'
import { DATAROOM_ICONS, type DataroomIconKey } from '@/entities/dataroom'
import { cn } from '@/shared/lib/utils'

interface IconPickerProps {
  value: DataroomIconKey | null
  onChange: (value: DataroomIconKey | null) => void
  disabled?: boolean
}

export function IconPicker({ value, onChange, disabled }: IconPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(null)}
        aria-label="No icon"
        aria-pressed={value === null}
        className={cn(
          'relative flex h-10 w-10 items-center justify-center rounded-lg border transition',
          value === null
            ? 'border-foreground bg-accent'
            : 'border-border hover:border-foreground/40 hover:bg-accent/60',
          disabled && 'opacity-40 pointer-events-none',
        )}
      >
        <span className="text-xs text-muted-foreground">None</span>
        {value === null ? (
          <Check className="absolute right-0.5 top-0.5 h-3 w-3 text-foreground" />
        ) : null}
      </button>
      {DATAROOM_ICONS.map((icon) => {
        const selected = value === icon.key
        return (
          <button
            key={icon.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(icon.key)}
            aria-label={icon.label}
            aria-pressed={selected}
            title={icon.label}
            className={cn(
              'relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border bg-background transition',
              selected
                ? 'border-foreground ring-2 ring-foreground/20'
                : 'border-border hover:border-foreground/40',
              disabled && 'opacity-40 pointer-events-none',
            )}
          >
            <img
              src={icon.src}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
              draggable={false}
            />
            {selected ? (
              <Check className="absolute right-0.5 top-0.5 h-3 w-3 text-foreground drop-shadow" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
