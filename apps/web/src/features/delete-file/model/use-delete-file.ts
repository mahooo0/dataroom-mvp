import { type FileRecord, fileSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fileKeys } from '@/entities/file'
import { usageKeys } from '@/entities/usage'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { showUndoToast } from '@/shared/lib/undo-toast'

interface Vars {
  id: string
  folderId: string
  name: string
}

interface Context {
  prev?: FileRecord[]
}

export function useDeleteFile() {
  const api = useApi()
  const qc = useQueryClient()

  const restore = useMutation({
    mutationFn: async ({ id }: { id: string; folderId: string }) => {
      const raw = await api.post(`files/${id}/restore`).json()
      return fileSchema.parse(raw)
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: fileKeys.inFolder(vars.folderId) })
      void qc.invalidateQueries({ queryKey: usageKeys.all })
    },
  })

  return useMutation<FileRecord, unknown, Vars, Context>({
    mutationFn: async ({ id }) => {
      const raw = await api.delete(`files/${id}`).json()
      return fileSchema.parse(raw)
    },
    onMutate: async ({ id, folderId }) => {
      const key = fileKeys.inFolder(folderId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<FileRecord[]>(key)
      qc.setQueryData<FileRecord[]>(key, (curr) => (curr ?? []).filter((f) => f.id !== id))
      return { prev }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(fileKeys.inFolder(vars.folderId), ctx.prev)
      toast.error(apiErrorMessage(err, 'Failed to delete file'))
    },
    onSuccess: (_deleted, vars) => {
      showUndoToast({
        message: `Deleted ${vars.name}`,
        onUndo: () => restore.mutate({ id: vars.id, folderId: vars.folderId }),
      })
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: fileKeys.inFolder(vars.folderId) })
      void qc.invalidateQueries({ queryKey: usageKeys.all })
    },
  })
}
