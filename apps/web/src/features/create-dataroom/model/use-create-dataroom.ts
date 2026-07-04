import { type CreateDataroomInput, type Dataroom, dataroomSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dataroomKeys } from '@/entities/dataroom'
import { useApi } from '@/shared/api/client'
import { handleMutationError } from '@/shared/lib/handle-mutation-error'

interface Context {
  prev?: Dataroom[]
  tempId: string
}

export function useCreateDataroom() {
  const api = useApi()
  const qc = useQueryClient()

  const mutation = useMutation<Dataroom, unknown, CreateDataroomInput, Context>({
    mutationFn: async (input) => {
      const raw = await api.post('datarooms', { json: input }).json()
      return dataroomSchema.parse(raw)
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: dataroomKeys.list() })
      const prev = qc.getQueryData<Dataroom[]>(dataroomKeys.list())
      const tempId = `temp-${crypto.randomUUID()}`
      const now = new Date().toISOString()
      const optimistic: Dataroom = {
        id: tempId,
        name: input.name,
        ownerId: '',
        iconKey: input.iconKey ?? null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      qc.setQueryData<Dataroom[]>(dataroomKeys.list(), [optimistic, ...(prev ?? [])])
      return { prev, tempId }
    },
    onError: (err, input, ctx) => {
      if (ctx?.prev) qc.setQueryData(dataroomKeys.list(), ctx.prev)
      const cached = qc.getQueryData<Dataroom[]>(dataroomKeys.list()) ?? []
      const existing = cached.find((d) => d.name === input.name && !d.deletedAt)
      handleMutationError(err, 'Failed to create dataroom', {
        entity: 'dataroom',
        attemptedName: input.name,
        onKeepBoth: (newName) => mutation.mutate({ ...input, name: newName }),
        onReplace: existing
          ? async () => {
              await api.delete(`datarooms/${existing.id}`).json()
              void qc.invalidateQueries({ queryKey: dataroomKeys.list() })
              mutation.mutate(input)
            }
          : undefined,
      })
    },
    onSuccess: (created, _input, ctx) => {
      qc.setQueryData<Dataroom[]>(dataroomKeys.list(), (curr) =>
        (curr ?? []).map((d) => (d.id === ctx?.tempId ? created : d)),
      )
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: dataroomKeys.list() })
    },
  })
  return mutation
}
