import { useAuth } from '@clerk/react'
import { Navigate, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { FullPageSpinner } from '@/shared/ui/full-page-spinner'

interface RequireAuthProps {
  children: ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()

  if (!isLoaded) return <FullPageSpinner label="Loading your session…" />
  if (!isSignedIn) {
    return (
      <Navigate
        to="/sign-in/$"
        params={{ _splat: '' }}
        search={{ redirect: location.pathname }}
        replace
      />
    )
  }
  return <>{children}</>
}
