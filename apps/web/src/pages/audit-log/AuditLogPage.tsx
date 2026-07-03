import type { LucideIcon } from 'lucide-react'
import { FileText, FolderPlus, LogIn, Trash2, Upload, UserCog } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'

type EventKind = 'signin' | 'create' | 'upload' | 'delete' | 'rename' | 'profile'

interface AuditEvent {
  id: string
  kind: EventKind
  actor: string
  action: string
  target?: string
  at: string
  ip?: string
}

const ICONS: Record<EventKind, LucideIcon> = {
  signin: LogIn,
  create: FolderPlus,
  upload: Upload,
  delete: Trash2,
  rename: FileText,
  profile: UserCog,
}

const TINTS: Record<EventKind, string> = {
  signin: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  create: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  upload: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  delete: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  rename: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  profile: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
}

const SAMPLE: AuditEvent[] = [
  {
    id: '1',
    kind: 'signin',
    actor: 'you',
    action: 'Signed in',
    at: '2 minutes ago',
    ip: '192.168.1.42',
  },
  {
    id: '2',
    kind: 'create',
    actor: 'you',
    action: 'Created dataroom',
    target: 'Q4 Acquisition',
    at: '1 hour ago',
  },
  {
    id: '3',
    kind: 'upload',
    actor: 'you',
    action: 'Uploaded file',
    target: 'financials-2025.pdf',
    at: '1 hour ago',
  },
  {
    id: '4',
    kind: 'rename',
    actor: 'you',
    action: 'Renamed folder',
    target: 'Legal → Legal & Compliance',
    at: '3 hours ago',
  },
  {
    id: '5',
    kind: 'delete',
    actor: 'you',
    action: 'Deleted file',
    target: 'draft-nda.pdf',
    at: 'Yesterday',
  },
  {
    id: '6',
    kind: 'profile',
    actor: 'you',
    action: 'Updated profile',
    at: '2 days ago',
  },
]

export function AuditLogPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Every action taken on your datarooms. Immutable, timestamped, exportable.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          Preview data
        </Badge>
      </header>

      <ol className="relative flex flex-col gap-0 rounded-2xl border bg-card">
        {SAMPLE.map((event, idx) => {
          const Icon = ICONS[event.kind]
          const tint = TINTS[event.kind]
          return (
            <li
              key={event.id}
              className={
                idx === SAMPLE.length - 1
                  ? 'flex items-start gap-4 p-4'
                  : 'flex items-start gap-4 border-b p-4'
              }
            >
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tint}`}
              >
                <Icon className="size-4" />
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="text-sm">
                  <span className="font-medium">{event.actor}</span> — {event.action}
                  {event.target ? (
                    <span className="text-muted-foreground"> · {event.target}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{event.at}</span>
                  {event.ip ? (
                    <>
                      <span>·</span>
                      <span className="font-mono">{event.ip}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
