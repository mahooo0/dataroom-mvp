import { useSignIn } from '@clerk/react'
import { useState } from 'react'
import { siGoogle } from 'simple-icons'
import { toast } from 'sonner'
import { GRADIENT_BTN } from '@/shared/lib/styles'
import { cn } from '@/shared/lib/utils'
import { RippleButton } from '@/shared/ui/ripple-button'
import { SimpleIcon } from '@/shared/ui/simple-icon'

interface SignInWithGoogleButtonProps {
  className?: string
  redirectTo?: string
}

export function SignInWithGoogleButton({
  className,
  redirectTo = '/datarooms',
}: SignInWithGoogleButtonProps) {
  const { signIn, isLoaded } = useSignIn()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    if (!isLoaded || !signIn) return
    try {
      setPending(true)
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: redirectTo,
      })
    } catch (err) {
      setPending(false)
      const message = err instanceof Error ? err.message : 'Google sign-in failed'
      toast.error(message)
    }
  }

  return (
    <RippleButton
      variant="outline"
      size="lg"
      className={cn(GRADIENT_BTN, 'w-full justify-center gap-3 rounded-xl', className)}
      disabled={!isLoaded || pending}
      onClick={handleClick}
      rippleColor="#89BEFF"
    >
      <SimpleIcon icon={siGoogle} className="size-5" />
      <span>Continue with Google</span>
    </RippleButton>
  )
}
