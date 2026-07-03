import { useSignIn } from '@clerk/react'
import { useState } from 'react'
import { siApple } from 'simple-icons'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/button'
import { SimpleIcon } from '@/shared/ui/simple-icon'

interface SignInWithAppleButtonProps {
  className?: string
  redirectTo?: string
}

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
    <Button
      variant="secondary"
      className={className}
      disabled={!isLoaded || pending}
      onClick={handleClick}
    >
      <SimpleIcon icon={siApple} className="mr-2 size-4" />
      Continue with Apple
    </Button>
  )
}
