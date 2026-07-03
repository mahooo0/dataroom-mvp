import { AuthenticateWithRedirectCallback } from '@clerk/react'
import { FullPageSpinner } from '@/shared/ui/full-page-spinner'

export function SsoCallbackPage() {
  return (
    <>
      <FullPageSpinner label="Finishing sign-in…" />
      <AuthenticateWithRedirectCallback
        afterSignInUrl="/datarooms"
        afterSignUpUrl="/datarooms"
        signInFallbackRedirectUrl="/datarooms"
        signUpFallbackRedirectUrl="/datarooms"
      />
    </>
  )
}
