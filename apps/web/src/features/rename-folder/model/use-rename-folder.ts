import { type Folder, folderSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { folderKeys } from '@/entities/folder'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'

interface Vars {
  id: string
  dataroomId: string
  name: string
}

interface Context {
  prev?: Folder[]
}

export function useRenameFolder() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<Folder, unknown, Vars, Context>({
    mutationFn: async ({ id, name }) => {
      const raw = await api.patch(`folders/${id}`, { json: { name } }).json()
      return folderSchema.parse(raw)
    },
    onMutate: async ({ id, dataroomId, name }) => {
      const key = folderKeys.inDataroom(dataroomId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Folder[]>(key)
      qc.setQueryData<Folder[]>(key, (curr) =>
        (curr ?? []).map((f) =>
          f.id === id ? { ...f, name, updatedAt: new Date().toISOString() } : f,
        ),
      )
      return { prev }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(folderKeys.inDataroom(vars.dataroomId), ctx.prev)
      toast.error(apiErrorMessage(err, 'Failed to rename folder'))
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: folderKeys.inDataroom(vars.dataroomId) })
    },
  })
}
