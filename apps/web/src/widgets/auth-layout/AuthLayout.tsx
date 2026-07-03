import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { APP_CONFIG } from '@/shared/config/app-config'
import { BrandMark } from '@/shared/ui/brand-mark'
import { ShaderBg } from '@/shared/ui/shader-bg'

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

          <div className="mx-auto flex w-full flex-col justify-center space-y-8 px-6 sm:w-[460px]">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="rounded-2xl bg-background/40 p-6 ring-1 ring-[#89BEFF]/20 shadow-[0_1px_0_rgba(137,190,255,0.15),0_24px_60px_-30px_rgba(137,190,255,0.35)] backdrop-blur"
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
          className="relative order-2 hidden h-full overflow-hidden rounded-3xl bg-[#eef0f3] text-neutral-900 lg:flex"
        >
          <ShaderBg colorBack="#eef0f3" colorFront="#7a8494" speed={0.45} scale={1.4} />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(238,240,243,0)_0%,rgba(238,240,243,0.55)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#eef0f3]/70 via-[#eef0f3]/20 to-[#eef0f3]/80" />

          <div className="relative z-10 flex h-full w-full flex-col justify-between p-10">
            <div className="space-y-3">
              <h1 className="max-w-md font-medium text-2xl leading-tight text-neutral-900">
                {APP_CONFIG.hero.title}
              </h1>
              <p className="max-w-md text-sm text-neutral-700">{APP_CONFIG.hero.subtitle}</p>
            </div>

            <div className="flex w-full flex-wrap justify-between gap-6">
              {APP_CONFIG.hero.highlights.map((h) => (
                <div key={h.heading} className="flex-1 min-w-[180px] space-y-1">
                  <h2 className="font-medium text-sm text-neutral-900">{h.heading}</h2>
                  <p className="text-sm text-neutral-700">{h.body}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  )
}
