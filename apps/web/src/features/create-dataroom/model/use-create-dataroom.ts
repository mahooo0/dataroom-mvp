import { type CreateDataroomInput, type Dataroom, dataroomSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dataroomKeys } from '@/entities/dataroom'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'

interface Context {
  prev?: Dataroom[]
  tempId: string
}

export function useCreateDataroom() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<Dataroom, unknown, CreateDataroomInput, Context>({
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
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      qc.setQueryData<Dataroom[]>(dataroomKeys.list(), [optimistic, ...(prev ?? [])])
      return { prev, tempId }
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(dataroomKeys.list(), ctx.prev)
      toast.error(apiErrorMessage(err, 'Failed to create dataroom'))
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
}
