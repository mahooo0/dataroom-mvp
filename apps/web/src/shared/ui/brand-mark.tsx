import { type HTMLMotionProps, motion } from 'motion/react'
import { cn } from '@/shared/lib/utils'

const BRAND_LAYOUT_ID = 'brand-mark'

type BrandMarkProps = Omit<HTMLMotionProps<'div'>, 'ref'>

/**
 * Same logical logo mounted in multiple places — the shared `layoutId`
 * lets `motion` cross-fade / cross-transform it between them, e.g.:
 * splash overlay (large, centered) → header (small, top-left).
 */
export function BrandMark({ className, transition, ...rest }: BrandMarkProps) {
  return (
    <motion.div
      layoutId={BRAND_LAYOUT_ID}
      transition={
        transition ?? {
          layout: { type: 'spring', stiffness: 180, damping: 24, mass: 1.05 },
          default: { duration: 0.35, ease: 'easeOut' },
        }
      }
      className={cn(
        'flex items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20',
        className,
      )}
      {...rest}
    >
      <svg
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="h-[60%] w-[60%]"
      >
        <path
          d="M4 10.5c0-2.485 2.015-4.5 4.5-4.5h5.318a4.5 4.5 0 0 1 3.182 1.318l1.591 1.591A2 2 0 0 0 20.005 9.5H23.5c2.485 0 4.5 2.015 4.5 4.5v6.75c0 2.485-2.015 4.5-4.5 4.5H8.5A4.5 4.5 0 0 1 4 20.75V10.5Z"
          fill="currentColor"
          opacity="0.15"
        />
        <path
          d="M4 12.75c0-2.485 2.015-4.5 4.5-4.5h5.318a4.5 4.5 0 0 1 3.182 1.318l1.591 1.591A2 2 0 0 0 20.005 11.75H23.5c2.485 0 4.5 2.015 4.5 4.5v6.75c0 2.485-2.015 4.5-4.5 4.5H8.5A4.5 4.5 0 0 1 4 23v-10.25Z"
          fill="currentColor"
        />
      </svg>
    </motion.div>
  )
}
