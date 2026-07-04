import { useClerk, useUser } from '@clerk/react'
import { HardDrive, LogOut, UserCog } from 'lucide-react'
import { useUsage } from '@/entities/usage'
import { formatBytes } from '@/shared/lib/format-bytes'
import { cn } from '@/shared/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import { Skeleton } from '@/shared/ui/skeleton'
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

      <StorageSection />

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

function toneBar(pct: number) {
  if (pct >= 95) return 'bg-destructive'
  if (pct >= 80) return 'bg-amber-500'
  return 'bg-foreground/80'
}

function StorageSection() {
  const { data, isLoading } = useUsage()

  return (
    <section
      id="storage"
      className="flex flex-col gap-5 rounded-2xl border bg-card p-6 scroll-mt-6"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2 text-foreground/70">
          <HardDrive className="size-4" />
        </div>
        <div>
          <div className="font-medium">Storage</div>
          <div className="text-sm text-muted-foreground">Space used across your datarooms.</div>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-5/6" />
        </div>
      ) : (
        <StorageBody data={data} />
      )}
    </section>
  )
}

function StorageBody({
  data,
}: {
  data: {
    usedBytes: number
    quotaBytes: number
    perDataroom: { dataroomId: string; name: string; bytes: number }[]
  }
}) {
  const pct = Math.min(100, Math.round((data.usedBytes / data.quotaBytes) * 100))
  const sorted = [...data.perDataroom].sort((a, b) => b.bytes - a.bytes)

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-2xl font-semibold tabular-nums">
            {formatBytes(data.usedBytes)}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              of {formatBytes(data.quotaBytes)}
            </span>
          </div>
          <div className="text-sm tabular-nums text-muted-foreground">{pct}%</div>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-[width] duration-300', toneBar(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          By dataroom
        </div>
        {sorted.length === 0 ? (
          <div className="text-sm text-muted-foreground">No datarooms yet.</div>
        ) : (
          <ul className="space-y-2">
            {sorted.map((d) => {
              const share = data.usedBytes > 0 ? (d.bytes / data.usedBytes) * 100 : 0
              return (
                <li
                  key={d.dataroomId}
                  className="flex flex-col gap-1.5 rounded-lg p-2 hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{d.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatBytes(d.bytes)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/60"
                      style={{ width: `${Math.max(share, d.bytes > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
