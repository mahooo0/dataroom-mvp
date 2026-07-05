import { type Dataroom, dataroomSchema, type RenameDataroomInput } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dataroomKeys } from '@/entities/dataroom'
import { ApiFailure, useApi } from '@/shared/api/client'
import { handleMutationError } from '@/shared/lib/handle-mutation-error'

interface Vars extends RenameDataroomInput {
  id: string
}

interface Context {
  prev?: Dataroom[]
}

export function useRenameDataroom() {
  const api = useApi()
  const qc = useQueryClient()

  const mutation = useMutation<Dataroom, unknown, Vars, Context>({
    mutationFn: async ({ id, name, iconKey }) => {
      if (name) {
        const cached = qc.getQueryData<Dataroom[]>(dataroomKeys.list()) ?? []
        if (cached.some((d) => d.id !== id && d.name === name && !d.deletedAt)) {
          throw new ApiFailure(
            {
              code: 'DATAROOM_NAME_TAKEN',
              message: 'A dataroom with that name already exists',
            },
            409,
          )
        }
      }
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
    onError: (err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(dataroomKeys.list(), ctx.prev)
      const cached = qc.getQueryData<Dataroom[]>(dataroomKeys.list()) ?? []
      const siblings = cached.filter((d) => d.id !== vars.id && !d.deletedAt)
      handleMutationError(
        err,
        'Failed to rename dataroom',
        vars.name
          ? {
              entity: 'dataroom',
              attemptedName: vars.name,
              takenNames: siblings.map((d) => d.name),
              onKeepBoth: (newName) => mutation.mutate({ ...vars, name: newName }),
            }
          : undefined,
      )
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: dataroomKeys.list() })
    },
  })
  return mutation
}
