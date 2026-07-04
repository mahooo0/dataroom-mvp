'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import { AnimatePresence, motion } from 'motion/react'
import * as React from 'react'
import { cn } from '@/shared/lib/utils'

const rippleButtonVariants = cva(
  "group/ripple relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        gradient:
          'text-primary-foreground shadow-sm bg-[linear-gradient(135deg,var(--primary)_0%,color-mix(in_oklab,var(--primary)_78%,var(--primary-foreground))_100%)] hover:brightness-110 dark:hover:brightness-95',
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline:
          'border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted hover:text-foreground dark:hover:bg-muted/50',
        destructive:
          'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/20',
      },
      size: {
        sm: 'h-8 gap-1.5 rounded-lg px-3 text-sm',
        default: 'h-10 gap-2 rounded-lg px-4 text-sm',
        lg: 'h-11 gap-2 rounded-xl px-5 text-[0.95rem]',
        icon: 'size-10 rounded-lg',
        'icon-sm': 'size-8 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'gradient',
      size: 'default',
    },
  },
)

type Ripple = { id: number; x: number; y: number; size: number }

type RippleContextValue = {
  ripples: Ripple[]
}

const RippleContext = React.createContext<RippleContextValue | null>(null)

export type RippleButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof rippleButtonVariants>

function RippleButton({
  className,
  variant,
  size,
  onClick,
  onPointerDown,
  children,
  ...props
}: RippleButtonProps) {
  const [ripples, setRipples] = React.useState<Ripple[]>([])
  const idRef = React.useRef(0)

  const spawnRipple = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2
    const x = event.clientX - rect.left - size / 2
    const y = event.clientY - rect.top - size / 2
    idRef.current += 1
    const id = idRef.current
    setRipples((prev) => [...prev, { id, x, y, size }])
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id))
    }, 700)
  }

  return (
    <RippleContext.Provider value={{ ripples }}>
      <button
        data-slot="ripple-button"
        data-variant={variant ?? 'gradient'}
        data-size={size ?? 'default'}
        className={cn(rippleButtonVariants({ variant, size, className }))}
        onPointerDown={(event) => {
          spawnRipple(event)
          onPointerDown?.(event)
        }}
        onClick={onClick}
        {...props}
      >
        {children}
      </button>
    </RippleContext.Provider>
  )
}

function RippleButtonRipples({ className }: { className?: string }) {
  const ctx = React.useContext(RippleContext)
  if (!ctx) return null
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]',
        className,
      )}
    >
      <AnimatePresence>
        {ctx.ripples.map((r) => (
          <motion.span
            key={r.id}
            initial={{ opacity: 0.45, scale: 0 }}
            animate={{ opacity: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="absolute rounded-full bg-primary-foreground/30"
            style={{
              left: r.x,
              top: r.y,
              width: r.size,
              height: r.size,
            }}
          />
        ))}
      </AnimatePresence>
    </span>
  )
}

export { RippleButton, RippleButtonRipples, rippleButtonVariants }
