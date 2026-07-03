import { SignUp } from '@clerk/react'
import { FolderLock } from 'lucide-react'

export function SignUpPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-2xl bg-primary/5 p-3 text-primary">
            <FolderLock className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
            <p className="text-sm text-muted-foreground">
              Start organizing your due-diligence documents.
            </p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/datarooms"
            appearance={{
              elements: {
                card: 'shadow-none border-none bg-transparent',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                formButtonPrimary:
                  'bg-primary text-primary-foreground hover:bg-primary/90',
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
