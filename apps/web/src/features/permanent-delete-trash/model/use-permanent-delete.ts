import type { TrashItem } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { trashKeys } from '@/entities/trash'
import { useApi } from '@/shared/api/client'

interface PermanentDeleteArgs {
  item: TrashItem
}

export function usePermanentDelete() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ item }: PermanentDeleteArgs) => {
      await api.delete(`trash/${item.kind}/${item.id}`).json()
    },
    onMutate: async ({ item }) => {
      await qc.cancelQueries({ queryKey: trashKeys.list() })
      const prev = qc.getQueryData<TrashItem[]>(trashKeys.list())
      qc.setQueryData<TrashItem[]>(trashKeys.list(), (curr) =>
        (curr ?? []).filter((i) => !(i.kind === item.kind && i.id === item.id)),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(trashKeys.list(), ctx.prev)
      toast.error('Could not permanently delete. Try again.')
    },
    onSuccess: (_res, { item }) => {
      toast.success(`Permanently deleted ${item.name}`)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: trashKeys.list() })
    },
  })
}
