import type { FileRecord } from '@dataroom/shared'
import { Check, Copy, Link2, Loader2, Share2 } from 'lucide-react'
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
import { useCreateShare, useRevokeShare, useShare } from '../model/use-share'

interface ShareFileDialogProps {
  file: FileRecord | null
  onClose: () => void
}

export function ShareFileDialog({ file, onClose }: ShareFileDialogProps) {
  const fileId = file?.id ?? null
  const { data: share, isLoading } = useShare(fileId)
  const create = useCreateShare(fileId ?? '')
  const revoke = useRevokeShare(fileId ?? '')
  const [copied, setCopied] = useState(false)

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
            Anyone with the link gets read-only access to this file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading share status…
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
              <p className="text-xs text-muted-foreground">
                Revoking the link will immediately break access for everyone using it.
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              This file isn&apos;t shared. Generate a link to send to reviewers.
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
              <RippleButton onClick={() => create.mutate()} disabled={create.isPending || !file}>
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
