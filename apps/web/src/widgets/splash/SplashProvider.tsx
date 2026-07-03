import { useAuth } from '@clerk/react'
import { AnimatePresence, LayoutGroup } from 'motion/react'
import { type ReactNode, useEffect, useState } from 'react'
import { SplashScreen } from './SplashScreen'

const MIN_SPLASH_MS = 900

interface SplashProviderProps {
  children: ReactNode
}

/**
 * Shows a full-screen brand overlay while Clerk boots. When both Clerk is
 * ready AND the minimum splash duration has elapsed, the overlay animates
 * out — the BrandMark inside it shares a `layoutId` with the one in the
 * header, so `motion` smoothly cross-fades / cross-transforms it into
 * the header slot.
 */
export function SplashProvider({ children }: SplashProviderProps) {
  const { isLoaded } = useAuth()
  const [minElapsed, setMinElapsed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS)
    return () => clearTimeout(t)
  }, [])

  const showSplash = !isLoaded || !minElapsed

  return (
    <LayoutGroup>
      {children}
      <AnimatePresence>{showSplash ? <SplashScreen /> : null}</AnimatePresence>
    </LayoutGroup>
  )
}
