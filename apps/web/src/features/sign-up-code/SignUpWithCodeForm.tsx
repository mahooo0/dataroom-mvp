import { useSignUp } from '@clerk/react/legacy'
import { useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { GRADIENT_BTN } from '@/shared/lib/styles'
import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/shared/ui/input-otp'
import { Label } from '@/shared/ui/label'
import { RippleButton } from '@/shared/ui/ripple-button'

type Step = 'email' | 'code'

interface SignUpWithCodeFormProps {
  redirectTo?: string
}

export function SignUpWithCodeForm({ redirectTo = '/datarooms' }: SignUpWithCodeFormProps) {
  const { signUp, setActive, isLoaded } = useSignUp()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)

  async function requestCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isLoaded || !signUp || pending) return
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast.error('Enter a valid email address')
      return
    }
    setPending(true)
    try {
      await signUp.create({ emailAddress: email })
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      setStep('code')
      toast.success(`We sent a code to ${email}`)
    } catch (err) {
      const message =
        (err as { errors?: { message: string }[] })?.errors?.[0]?.message ??
        (err instanceof Error ? err.message : 'Failed to sign up')
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  async function verifyCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isLoaded || !signUp || pending) return
    if (code.length !== 6) return
    setPending(true)
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code })
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId })
        navigate({ to: redirectTo })
      } else {
        toast.error(`Verification incomplete (${attempt.status})`)
      }
    } catch (err) {
      const message =
        (err as { errors?: { message: string }[] })?.errors?.[0]?.message ??
        (err instanceof Error ? err.message : 'Wrong code')
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {step === 'email' ? (
        <motion.form
          key="email"
          onSubmit={requestCode}
          className="flex flex-col gap-4"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="h-12 rounded-xl px-4 text-[15px]"
            />
          </div>
          <RippleButton
            type="submit"
            variant="outline"
            size="lg"
            disabled={pending}
            className={cn(GRADIENT_BTN, 'w-full justify-center rounded-xl')}
            rippleColor="#89BEFF"
          >
            {pending ? 'Sending code…' : 'Continue with email'}
          </RippleButton>
        </motion.form>
      ) : (
        <motion.form
          key="code"
          onSubmit={verifyCode}
          className="flex flex-col gap-4"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          transition={{ duration: 0.25 }}
        >
          <div className="grid gap-2 text-center">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to <span className="text-foreground">{email}</span>
            </p>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                autoFocus
                onComplete={(value) => {
                  if (value.length === 6) {
                    void verifyCode({
                      preventDefault: () => {},
                    } as unknown as FormEvent<HTMLFormElement>)
                  }
                }}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <RippleButton
            type="submit"
            variant="outline"
            size="lg"
            disabled={pending || code.length !== 6}
            className={cn(GRADIENT_BTN, 'w-full justify-center rounded-xl')}
            rippleColor="#89BEFF"
          >
            {pending ? 'Verifying…' : 'Create account'}
          </RippleButton>
          <button
            type="button"
            className="text-center text-xs text-muted-foreground hover:text-foreground transition"
            onClick={() => {
              setCode('')
              setStep('email')
            }}
          >
            Use a different email
          </button>
        </motion.form>
      )}
    </AnimatePresence>
  )
}
