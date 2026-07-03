import { motion } from 'motion/react'
import { APP_CONFIG } from '@/shared/config/app-config'
import { BrandMark } from '@/shared/ui/brand-mark'

export function SplashScreen() {
  return (
    <motion.div
      key="splash"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
    >
      <div className="flex flex-col items-center gap-6">
        <BrandMark className="h-28 w-28" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ delay: 0.15, duration: 0.35, ease: 'easeOut' }}
          className="flex flex-col items-center gap-1 text-center"
        >
          <h1 className="text-xl font-medium tracking-tight">{APP_CONFIG.name}</h1>
          <p className="text-sm text-muted-foreground">{APP_CONFIG.tagline}</p>
        </motion.div>
      </div>
    </motion.div>
  )
}
