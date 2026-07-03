import { useClerk, useUser } from '@clerk/react'
import { LogOut, UserCog } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import { ThemeToggle } from '@/widgets/header/ThemeToggle'

export function SettingsPage() {
  const { user } = useUser()
  const { signOut, openUserProfile } = useClerk()

  const name = user?.fullName ?? user?.username ?? 'You'
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, appearance, and session.
        </p>
      </header>

      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-14 rounded-xl">
            <AvatarImage src={user?.imageUrl || undefined} alt={name} />
            <AvatarFallback className="rounded-xl">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="font-medium">{name}</div>
            <div className="text-sm text-muted-foreground">{email}</div>
          </div>
          <Button variant="outline" onClick={() => openUserProfile()}>
            <UserCog className="mr-2 size-4" />
            Manage profile
          </Button>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-2xl border bg-card p-6">
        <div>
          <div className="font-medium">Appearance</div>
          <div className="text-sm text-muted-foreground">Light, dark, or match your system.</div>
        </div>
        <ThemeToggle />
      </section>

      <Separator />

      <section className="flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <div>
          <div className="font-medium">Sign out</div>
          <div className="text-sm text-muted-foreground">
            End this session and return to the sign-in page.
          </div>
        </div>
        <Button variant="destructive" onClick={() => signOut({ redirectUrl: '/sign-in' })}>
          <LogOut className="mr-2 size-4" />
          Sign out
        </Button>
      </section>
    </div>
  )
}
