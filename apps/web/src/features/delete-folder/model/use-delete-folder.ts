import { type Folder, folderSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fileKeys } from '@/entities/file'
import { folderKeys } from '@/entities/folder'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { showUndoToast } from '@/shared/lib/undo-toast'

interface Vars {
  id: string
  dataroomId: string
  name: string
}

interface Context {
  prev?: Folder[]
}

export function useDeleteFolder() {
  const api = useApi()
  const qc = useQueryClient()

  const restore = useMutation({
    mutationFn: async ({ id }: { id: string; dataroomId: string }) => {
      const raw = await api.post(`folders/${id}/restore`).json()
      return folderSchema.parse(raw)
    },
    onSettled: (_d, _e, vars) => {
      void qc.invalidateQueries({ queryKey: folderKeys.inDataroom(vars.dataroomId) })
      void qc.invalidateQueries({ queryKey: fileKeys.all })
    },
  })

  return useMutation<Folder, unknown, Vars, Context>({
    mutationFn: async ({ id }) => {
      const raw = await api.delete(`folders/${id}`).json()
      return folderSchema.parse(raw)
    },
    onMutate: async ({ id, dataroomId }) => {
      const key = folderKeys.inDataroom(dataroomId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Folder[]>(key)
      const removeIds = new Set<string>()
      const collect = (parentId: string) => {
        removeIds.add(parentId)
        for (const f of prev ?? []) {
          if (f.parentId === parentId) collect(f.id)
        }
      }
      collect(id)
      qc.setQueryData<Folder[]>(key, (curr) => (curr ?? []).filter((f) => !removeIds.has(f.id)))
      return { prev }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(folderKeys.inDataroom(vars.dataroomId), ctx.prev)
      toast.error(apiErrorMessage(err, 'Failed to delete folder'))
    },
    onSuccess: (_deleted, vars) => {
      showUndoToast({
        message: `Deleted ${vars.name}`,
        onUndo: () => restore.mutate({ id: vars.id, dataroomId: vars.dataroomId }),
      })
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: folderKeys.inDataroom(vars.dataroomId) })
      void qc.invalidateQueries({ queryKey: fileKeys.all })
    },
  })
}
