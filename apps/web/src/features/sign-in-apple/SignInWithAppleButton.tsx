import { useSignIn } from '@clerk/react'
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

  async function handleClick() {
    if (!isLoaded || !signIn) return
    try {
      setPending(true)
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_apple',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: redirectTo,
      })
    } catch (err) {
      setPending(false)
      const message = err instanceof Error ? err.message : 'Apple sign-in failed'
      toast.error(message)
    }
  }

  return (
    <RippleButton
      size="lg"
      className={cn(
        'w-full justify-center gap-3 rounded-xl',
        'border border-black bg-black text-white shadow-sm',
        'hover:bg-neutral-900',
        'dark:bg-black dark:text-white dark:border-black',
        className,
      )}
      disabled={!isLoaded || pending}
      onClick={handleClick}
      rippleColor="#ffffff"
      rippleOpacity={0.25}
    >
      <AppleWhiteIcon className="size-5" />
      <span className="text-[15px] font-medium">Continue with Apple</span>
    </RippleButton>
  )
}
