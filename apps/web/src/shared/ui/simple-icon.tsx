import type { ComponentProps } from 'react'
import type { SimpleIcon as ISimpleIcon } from 'simple-icons'
import { cn } from '@/shared/lib/utils'

interface SimpleIconProps extends ComponentProps<'svg'> {
  icon: ISimpleIcon
}

export function SimpleIcon({ icon, className, ...props }: SimpleIconProps) {
  return (
    <svg
      role="img"
      aria-label={icon.title}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-4', className)}
      {...props}
    >
      <title>{icon.title}</title>
      <path d={icon.path} fill="currentColor" />
    </svg>
  )
}
