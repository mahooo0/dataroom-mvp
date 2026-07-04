import { AuthenticateWithRedirectCallback } from '@clerk/react'
import { FullPageSpinner } from '@/shared/ui/full-page-spinner'

export function SsoCallbackPage() {
  return (
    <>
      <FullPageSpinner label="Finishing sign-in…" />
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/datarooms"
        signUpFallbackRedirectUrl="/datarooms"
      />
    </>
  )
}
