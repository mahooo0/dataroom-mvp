import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { APP_CONFIG } from '@/shared/config/app-config'
import { BrandMark } from '@/shared/ui/brand-mark'

interface AuthLayoutProps {
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ children, footer }: AuthLayoutProps) {
  return (
    <main>
      <div className="grid h-dvh gap-2 p-2 lg:grid-cols-2">
        {/* Left / form */}
        <div className="relative order-1 flex h-full">
          <div className="absolute top-6 left-6 flex items-center gap-2 text-sm font-medium">
            <BrandMark className="h-7 w-7" />
            <span className="hidden sm:inline">{APP_CONFIG.name}</span>
          </div>

          <div className="mx-auto flex w-full flex-col justify-center space-y-8 px-6 sm:w-[380px]">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </div>

          {footer ? (
            <div className="absolute top-5 flex w-full justify-end px-6 text-sm text-muted-foreground">
              {footer}
            </div>
          ) : null}

          <div className="absolute bottom-5 left-0 flex w-full items-center justify-between px-6 text-xs text-muted-foreground">
            <span>{APP_CONFIG.copyright}</span>
          </div>
        </div>

        {/* Right / hero */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
          className="relative order-2 hidden h-full overflow-hidden rounded-3xl bg-primary text-primary-foreground lg:flex"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.14),_transparent_50%)]" />

          <div className="absolute top-10 space-y-3 px-10">
            <h1 className="font-medium text-2xl leading-tight max-w-md">{APP_CONFIG.hero.title}</h1>
            <p className="text-sm max-w-md text-primary-foreground/80">
              {APP_CONFIG.hero.subtitle}
            </p>
          </div>

          <div className="absolute bottom-10 flex w-full justify-between gap-6 px-10">
            {APP_CONFIG.hero.highlights.map((h) => (
              <div key={h.heading} className="flex-1 space-y-1">
                <h2 className="font-medium text-sm">{h.heading}</h2>
                <p className="text-sm text-primary-foreground/80">{h.body}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  )
}
