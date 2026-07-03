import { Loader2 } from 'lucide-react'

interface FullPageSpinnerProps {
  label?: string
}

export function FullPageSpinner({ label = 'Loading…' }: FullPageSpinnerProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  )
}
