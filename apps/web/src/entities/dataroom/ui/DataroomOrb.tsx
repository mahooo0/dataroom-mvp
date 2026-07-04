import { findIcon } from '../model/orbs'

interface DataroomOrbProps {
  id: string
  iconKey: string | null | undefined
  size?: number
  className?: string
}

function hueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 360
}

export function DataroomOrb({ id, iconKey, size = 18, className }: DataroomOrbProps) {
  const icon = findIcon(iconKey)
  if (icon) {
    return (
      <span
        aria-hidden
        className={`shrink-0 overflow-hidden rounded-full bg-background ${className ?? ''}`}
        style={{ width: size, height: size }}
      >
        <img src={icon.src} alt="" draggable={false} className="h-full w-full object-cover" />
      </span>
    )
  }
  const hue = hueFromId(id)
  return (
    <span
      aria-hidden
      className={`relative inline-block shrink-0 overflow-hidden rounded-full ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 30%, hsl(${hue} 95% 78%) 0%, hsl(${(hue + 20) % 360} 85% 55%) 45%, hsl(${(hue + 40) % 360} 75% 32%) 100%)`,
        boxShadow: `inset -1px -1px 2px hsl(${(hue + 40) % 360} 60% 20% / 0.6), inset 1px 1px 2px hsl(${hue} 100% 90% / 0.7)`,
      }}
    />
  )
}
