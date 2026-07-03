import { Link } from '@tanstack/react-router'
import { SignInWithCodeForm } from '@/features/sign-in-code/SignInWithCodeForm'
import { SignInWithGoogleButton } from '@/features/sign-in-google/SignInWithGoogleButton'
import { AuthLayout } from '@/widgets/auth-layout/AuthLayout'

export function SignInPage() {
  return (
    <AuthLayout
      footer={
        <span>
          New here?{' '}
          <Link
            to="/sign-up/$"
            params={{ _splat: '' }}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </span>
      }
    >
      <div className="space-y-2 text-center">
        <h1 className="font-medium text-3xl tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to continue to your datarooms.</p>
      </div>

      <div className="mt-8 space-y-4">
        <SignInWithGoogleButton className="w-full" />

        <div className="relative text-center text-xs uppercase tracking-widest">
          <div className="absolute inset-0 top-1/2 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-background px-3 text-muted-foreground">or with email</span>
        </div>

        <SignInWithCodeForm />
      </div>
    </AuthLayout>
  )
}
