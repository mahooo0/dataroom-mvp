import { type FileRecord, SHARE_TTL_OPTIONS, type ShareTtlKey } from '@dataroom/shared'
import { Check, Copy, Link2, Share2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { RippleButton, RippleButtonRipples } from '@/shared/ui/animate-ui/components/buttons/ripple'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Skeleton } from '@/shared/ui/skeleton'
import { Switch } from '@/shared/ui/switch'
import { useCreateShare, useRevokeShare, useShare } from '../model/use-share'

interface ShareFileDialogProps {
  file: FileRecord | null
  onClose: () => void
}

function formatExpiry(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now()
  if (diffMs <= 0) return 'expired'
  const minutes = Math.floor(diffMs / (60 * 1000))
  if (minutes < 60) return `expires in ${Math.max(1, minutes)}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `expires in ${hours}h`
  const days = Math.floor(hours / 24)
  return `expires in ${days} days`
}

export function ShareFileDialog({ file, onClose }: ShareFileDialogProps) {
  const fileId = file?.id ?? null
  const { data: share, isLoading } = useShare(fileId)
  const create = useCreateShare(fileId ?? '')
  const revoke = useRevokeShare(fileId ?? '')
  const [copied, setCopied] = useState(false)
  const [ttl, setTtl] = useState<ShareTtlKey>('7d')
  const [allowDownload, setAllowDownload] = useState(false)

  const shareUrl = share?.shareUrl

  const copyLink = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Copy failed — select and copy manually')
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share &quot;{file?.name}&quot;
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can view this file in the browser. Downloads are off by default.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-3 w-40" />
            </div>
          ) : share ? (
            <>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    readOnly
                    value={shareUrl}
                    onClick={(e) => e.currentTarget.select()}
                    className="pl-9 font-mono text-xs"
                  />
                </div>
                <Button size="icon" variant="outline" onClick={copyLink} aria-label="Copy link">
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active · {formatExpiry(share.expiresAt)}
                </span>
                <span className="opacity-60">·</span>
                <span>
                  Download:{' '}
                  <span className="font-medium">
                    {share.allowDownload ? 'allowed' : 'view-only'}
                  </span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Revoke to break access immediately, or re-share with different settings.
              </p>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid gap-2">
                <Label htmlFor="share-ttl" className="text-xs">
                  Link expires after
                </Label>
                <div className="flex gap-1 rounded-md border bg-muted/30 p-0.5">
                  {SHARE_TTL_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setTtl(opt.key)}
                      className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition ${
                        ttl === opt.key
                          ? 'bg-background shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <Label htmlFor="share-download" className="text-sm font-medium">
                    Allow download
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Off: recipients can only view in the browser. Recommended for confidential
                    material.
                  </p>
                </div>
                <Switch
                  id="share-download"
                  checked={allowDownload}
                  onCheckedChange={setAllowDownload}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {share ? (
            <Button
              variant="destructive"
              onClick={() => revoke.mutate()}
              disabled={revoke.isPending}
            >
              {revoke.isPending ? 'Revoking…' : 'Revoke link'}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {!share ? (
              <RippleButton
                onClick={() => create.mutate({ ttl, allowDownload })}
                disabled={create.isPending || !file}
              >
                <Link2 className="mr-2 h-4 w-4" />
                {create.isPending ? 'Creating…' : 'Create link'}
                <RippleButtonRipples />
              </RippleButton>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
