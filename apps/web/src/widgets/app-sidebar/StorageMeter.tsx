import { useNavigate } from '@tanstack/react-router'
import { HardDrive } from 'lucide-react'
import { useUsage } from '@/entities/usage'
import { formatBytes } from '@/shared/lib/format-bytes'
import { cn } from '@/shared/lib/utils'
import { useSidebar } from '@/shared/ui/animate-ui/components/radix/sidebar'

function toneClasses(pct: number) {
  if (pct >= 95) return { bar: 'bg-destructive', ring: 'text-destructive' }
  if (pct >= 80) return { bar: 'bg-amber-500', ring: 'text-amber-500' }
  return { bar: 'bg-foreground/80', ring: 'text-foreground/80' }
}

export function StorageMeter() {
  const { data, isLoading } = useUsage()
  const { state } = useSidebar()
  const navigate = useNavigate()

  if (isLoading || !data) return null

  const pct = Math.min(100, Math.round((data.usedBytes / data.quotaBytes) * 100))
  const { bar, ring } = toneClasses(pct)
  const isCollapsed = state === 'collapsed'

  const goSettings = () => void navigate({ to: '/settings', hash: 'storage' })

  if (isCollapsed) {
    const size = 28
    const stroke = 3
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    return (
      <button
        type="button"
        onClick={goSettings}
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-[10px] hover:bg-accent/60"
        title={`${formatBytes(data.usedBytes)} of ${formatBytes(data.quotaBytes)}`}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className={ring}
          role="img"
          aria-label={`${pct}% used`}
        >
          <title>{`${pct}% used`}</title>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="currentColor"
            strokeOpacity="0.2"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="currentColor"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={c - (c * pct) / 100}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={goSettings}
      className="mx-2 flex flex-col gap-1.5 rounded-[10px] px-2 py-2 text-left transition hover:bg-accent/60"
    >
      <div className="flex items-center gap-2 text-xs">
        <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground/80">Storage</span>
        <span className="ml-auto tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-[11px] tabular-nums text-muted-foreground">
        {formatBytes(data.usedBytes)} of {formatBytes(data.quotaBytes)}
      </div>
    </button>
  )
}
