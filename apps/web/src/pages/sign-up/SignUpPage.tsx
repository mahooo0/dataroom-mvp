import { Link } from '@tanstack/react-router'
import { SignInWithAppleButton } from '@/features/sign-in-apple/SignInWithAppleButton'
import { SignInWithGoogleButton } from '@/features/sign-in-google/SignInWithGoogleButton'
import { SignUpWithCodeForm } from '@/features/sign-up-code/SignUpWithCodeForm'
import { AuthLayout } from '@/widgets/auth-layout/AuthLayout'

export function SignUpPage() {
  return (
    <AuthLayout
      footer={
        <span>
          Already have an account?{' '}
          <Link
            to="/sign-in/$"
            params={{ _splat: '' }}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </span>
      }
    >
      <div className="space-y-2 text-center">
        <h1 className="font-medium text-3xl tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Start organizing your due-diligence documents.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SignInWithGoogleButton className="w-full" />
          <SignInWithAppleButton className="w-full" />
        </div>

        <div className="relative text-center text-xs uppercase tracking-widest">
          <div className="absolute inset-0 top-1/2 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-background px-3 text-muted-foreground">or with email</span>
        </div>

        <SignUpWithCodeForm />
      </div>
    </AuthLayout>
  )
}
