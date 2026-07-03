import { type Dataroom, dataroomSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dataroomKeys } from '@/entities/dataroom'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { showUndoToast } from '@/shared/lib/undo-toast'

interface Context {
  prev?: Dataroom[]
}

export function useDeleteDataroom() {
  const api = useApi()
  const qc = useQueryClient()

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const raw = await api.post(`datarooms/${id}/restore`).json()
      return dataroomSchema.parse(raw)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: dataroomKeys.list() })
    },
  })

  const remove = useMutation<Dataroom, unknown, { id: string; name: string }, Context>({
    mutationFn: async ({ id }) => {
      const raw = await api.delete(`datarooms/${id}`).json()
      return dataroomSchema.parse(raw)
    },
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: dataroomKeys.list() })
      const prev = qc.getQueryData<Dataroom[]>(dataroomKeys.list())
      qc.setQueryData<Dataroom[]>(dataroomKeys.list(), (curr) =>
        (curr ?? []).filter((d) => d.id !== id),
      )
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(dataroomKeys.list(), ctx.prev)
      toast.error(apiErrorMessage(err, 'Failed to delete dataroom'))
    },
    onSuccess: (_deleted, vars) => {
      showUndoToast({
        message: `Deleted ${vars.name}`,
        onUndo: () => restore.mutate(vars.id),
      })
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: dataroomKeys.list() })
    },
  })

  return remove
}
