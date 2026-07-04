import { AlertTriangle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNameConflictStore } from '@/shared/lib/name-conflict-store'
import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { Input } from './input'
import { Label } from './label'

const ENTITY_LABEL = {
  dataroom: 'dataroom',
  folder: 'folder',
  file: 'file',
} as const

export function NameConflictDialog() {
  const current = useNameConflictStore((s) => s.current)
  const close = useNameConflictStore((s) => s.close)

  const [name, setName] = useState('')
  const [replacing, setReplacing] = useState(false)

  useEffect(() => {
    if (current) {
      setName(current.suggestion)
      setReplacing(false)
    }
  }, [current])

  const open = !!current
  const entity = current ? ENTITY_LABEL[current.entity] : 'item'
  const canReplace = !!current?.onReplace

  const onKeepBoth = () => {
    if (!current) return
    const trimmed = name.trim()
    if (!trimmed || trimmed === current.attemptedName) return
    current.onKeepBoth(trimmed)
    close()
  }

  const onReplace = async () => {
    if (!current?.onReplace) return
    setReplacing(true)
    try {
      await current.onReplace()
      close()
    } finally {
      setReplacing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !replacing && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
            Name already used
          </DialogTitle>
          <DialogDescription>
            A {entity} named <span className="font-medium">{current?.attemptedName}</span> already
            exists here.
            {canReplace
              ? ' Replace it, rename this one, or cancel.'
              : ' Rename this one and keep both, or cancel.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label htmlFor="conflict-name">New name</Label>
          <Input
            id="conflict-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onKeepBoth()
              }
            }}
            autoFocus
          />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={close} disabled={replacing}>
            Cancel
          </Button>
          <div className="flex flex-wrap gap-2">
            {canReplace ? (
              <Button variant="destructive" onClick={onReplace} disabled={replacing}>
                {replacing ? 'Replacing…' : 'Replace'}
              </Button>
            ) : null}
            <Button
              onClick={onKeepBoth}
              disabled={replacing || !name.trim() || name.trim() === current?.attemptedName}
            >
              Keep both
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
