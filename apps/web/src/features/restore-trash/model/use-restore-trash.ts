import type { TrashItem } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dataroomKeys } from '@/entities/dataroom'
import { fileKeys } from '@/entities/file'
import { folderKeys } from '@/entities/folder'
import { trashKeys } from '@/entities/trash'
import { useApi } from '@/shared/api/client'

interface RestoreArgs {
  item: TrashItem
}

export function useRestoreTrash() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ item }: RestoreArgs) => {
      if (item.kind === 'dataroom') {
        await api.post(`datarooms/${item.id}/restore`).json()
      } else if (item.kind === 'folder') {
        await api.post(`folders/${item.id}/restore`).json()
      } else {
        await api.post(`files/${item.id}/restore`).json()
      }
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
      toast.error('Could not restore. Try again.')
    },
    onSuccess: (_res, { item }) => {
      toast.success(`Restored ${item.name}`)
    },
    onSettled: (_res, _err, { item }) => {
      qc.invalidateQueries({ queryKey: trashKeys.list() })
      qc.invalidateQueries({ queryKey: dataroomKeys.all })
      if (item.kind !== 'dataroom') {
        qc.invalidateQueries({ queryKey: folderKeys.inDataroom(item.dataroomId) })
      }
      if (item.kind === 'file') {
        qc.invalidateQueries({ queryKey: fileKeys.inFolder(item.folderId) })
      }
    },
  })
}
