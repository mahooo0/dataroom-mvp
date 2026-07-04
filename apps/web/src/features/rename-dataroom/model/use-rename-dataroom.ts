import { type Dataroom, dataroomSchema, type RenameDataroomInput } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dataroomKeys } from '@/entities/dataroom'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'

interface Vars extends RenameDataroomInput {
  id: string
}

interface Context {
  prev?: Dataroom[]
}

export function useRenameDataroom() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<Dataroom, unknown, Vars, Context>({
    mutationFn: async ({ id, name, iconKey }) => {
      const raw = await api.patch(`datarooms/${id}`, { json: { name, iconKey } }).json()
      return dataroomSchema.parse(raw)
    },
    onMutate: async ({ id, name, iconKey }) => {
      await qc.cancelQueries({ queryKey: dataroomKeys.list() })
      const prev = qc.getQueryData<Dataroom[]>(dataroomKeys.list())
      qc.setQueryData<Dataroom[]>(dataroomKeys.list(), (curr) =>
        (curr ?? []).map((d) =>
          d.id === id
            ? {
                ...d,
                name: name ?? d.name,
                iconKey: iconKey === undefined ? d.iconKey : iconKey,
                updatedAt: new Date().toISOString(),
              }
            : d,
        ),
      )
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(dataroomKeys.list(), ctx.prev)
      toast.error(apiErrorMessage(err, 'Failed to rename dataroom'))
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: dataroomKeys.list() })
    },
  })
}
