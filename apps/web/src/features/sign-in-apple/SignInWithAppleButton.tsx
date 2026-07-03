import { useSignIn } from '@clerk/react/legacy'
import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { AppleWhiteIcon } from '@/shared/ui/oauth-icons'
import { RippleButton } from '@/shared/ui/ripple-button'

interface SignInWithAppleButtonProps {
  className?: string
  redirectTo?: string
}

/**
 * Apple sign-in button — official black surface, white text and Apple
 * mark, matching Apple's brand guidelines. Not tinted with the app
 * blue gradient (brand policy for Apple auth).
 */
export function SignInWithAppleButton({
  className,
  redirectTo = '/datarooms',
}: SignInWithAppleButtonProps) {
  const { signIn, isLoaded } = useSignIn()
  const [pending, setPending] = useState(false)
  const busy = pending || !isLoaded

  async function handleClick() {
    if (!isLoaded || !signIn) return
    try {
      setPending(true)
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_apple',
        redirectUrl: `${window.location.origin}/sso-callback`,
        redirectUrlComplete: `${window.location.origin}${redirectTo}`,
      })
    } catch (err) {
      setPending(false)
      console.error('[Apple OAuth]', err)
      const message =
        (err as { errors?: { message: string }[] })?.errors?.[0]?.message ??
        (err instanceof Error ? err.message : 'Apple sign-in failed')
      toast.error(message)
    }
  }

  return (
    <RippleButton
      size="lg"
      className={cn(
        'h-12 w-full justify-center gap-3 rounded-xl',
        'border border-black bg-black text-white shadow-sm',
        'hover:bg-[#1a1a1a] hover:border-[#1a1a1a]',
        'dark:bg-black dark:text-white dark:border-black',
        className,
      )}
      disabled={busy}
      onClick={handleClick}
      rippleColor="#ffffff"
      rippleOpacity={0.25}
    >
      <AppleWhiteIcon className="size-5" />
      <span className="text-[15px] font-medium">Continue with Apple</span>
    </RippleButton>
  )
}
