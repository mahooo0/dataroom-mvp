import { Monitor, Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/shared/lib/theme'
import { Button } from '@/shared/ui/button'

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const label = theme === 'light' ? 'Light theme' : theme === 'dark' ? 'Dark theme' : 'System theme'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme (current: ${label})`}
      title={label}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  )
}
