import { type Folder, folderSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { folderKeys } from '@/entities/folder'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'

interface Vars {
  id: string
  dataroomId: string
  fromParentId: string | null
  toParentId: string | null
  name: string
}

interface Context {
  prev?: Folder[]
}

export function useMoveFolder() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<Folder, unknown, Vars, Context>({
    mutationFn: async ({ id, toParentId }) => {
      const raw = await api.patch(`folders/${id}/move`, { json: { parentId: toParentId } }).json()
      return folderSchema.parse(raw)
    },
    onMutate: async ({ id, dataroomId, fromParentId, toParentId }) => {
      if (fromParentId === toParentId) return {}
      const key = folderKeys.inDataroom(dataroomId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Folder[]>(key)
      qc.setQueryData<Folder[]>(key, (curr) =>
        (curr ?? []).map((f) =>
          f.id === id ? { ...f, parentId: toParentId, updatedAt: new Date().toISOString() } : f,
        ),
      )
      return { prev }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(folderKeys.inDataroom(vars.dataroomId), ctx.prev)
      toast.error(apiErrorMessage(err, `Couldn't move ${vars.name}`))
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: folderKeys.inDataroom(vars.dataroomId) })
    },
  })
}
