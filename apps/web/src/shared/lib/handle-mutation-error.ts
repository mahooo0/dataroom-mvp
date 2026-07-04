import { toast } from 'sonner'
import { apiErrorMessage, toApiFailure } from './api-error'
import { type NameConflictEntity, useNameConflictStore } from './name-conflict-store'
import { suggestNextName } from './next-name'

const CONFLICT_CODES = new Set(['DATAROOM_NAME_TAKEN', 'FOLDER_NAME_TAKEN', 'FILE_NAME_TAKEN'])

interface ConflictOpts {
  entity: NameConflictEntity
  attemptedName: string
  onKeepBoth: (newName: string) => void
  onReplace?: () => void | Promise<void>
}

/**
 * Route a mutation error to either the name-conflict modal (for 409 collisions)
 * or a plain toast (everything else). Keeps mutation onError handlers small
 * and gives the user a real way to resolve duplicate names.
 */
export function handleMutationError(err: unknown, fallback: string, conflict?: ConflictOpts): void {
  const failure = toApiFailure(err)
  if (conflict && failure && CONFLICT_CODES.has(failure.code)) {
    useNameConflictStore.getState().open({
      entity: conflict.entity,
      attemptedName: conflict.attemptedName,
      suggestion: suggestNextName(conflict.attemptedName),
      onKeepBoth: conflict.onKeepBoth,
      onReplace: conflict.onReplace,
    })
    return
  }
  toast.error(apiErrorMessage(err, fallback))
}
