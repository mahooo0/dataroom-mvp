import { useSignIn } from '@clerk/react/legacy'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { GoogleColorIcon } from '@/shared/ui/oauth-icons'
import { RippleButton } from '@/shared/ui/ripple-button'

interface SignInWithGoogleButtonProps {
  className?: string
  redirectTo?: string
}

/**
 * Clerk-style Google button — white surface, thin border, official
 * 4-color Google G. Neutral treatment on purpose: leave the blue
 * gradient for the true primary CTA.
 */
export function SignInWithGoogleButton({
  className,
  redirectTo = '/datarooms',
}: SignInWithGoogleButtonProps) {
  const { signIn, isLoaded } = useSignIn()
  const [pending, setPending] = useState(false)
  const busy = pending || !isLoaded

  async function handleClick() {
    if (!isLoaded || !signIn) return
    try {
      setPending(true)
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}${redirectTo}`,
      })
    } catch (err) {
      setPending(false)
      console.error('[Google OAuth]', err)
      const message =
        (err as { errors?: { message: string }[] })?.errors?.[0]?.message ??
        (err instanceof Error ? err.message : 'Google sign-in failed')
      toast.error(message)
    }
  }

  return (
    <RippleButton
      size="lg"
      className={cn(
        'h-12 w-full justify-center gap-3 rounded-xl',
        'border border-[#DADCE0] bg-white text-neutral-900 shadow-sm',
        'hover:bg-[#F8F9FA] hover:border-[#C6C9CE]',
        'dark:bg-white dark:text-neutral-900 dark:border-[#DADCE0]',
        className,
      )}
      disabled={busy}
      onClick={handleClick}
      rippleColor="#4285F4"
      rippleOpacity={0.18}
    >
      <GoogleColorIcon className="size-5" />
      <span className="text-[15px] font-medium">Continue with Google</span>
    </RippleButton>
  )
}
