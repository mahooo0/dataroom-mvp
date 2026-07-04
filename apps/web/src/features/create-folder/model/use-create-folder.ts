import { type CreateFolderInput, type Folder, folderSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { folderKeys } from '@/entities/folder'
import { useApi } from '@/shared/api/client'
import { handleMutationError } from '@/shared/lib/handle-mutation-error'

interface Context {
  prev?: Folder[]
  tempId: string
}

export function useCreateFolder() {
  const api = useApi()
  const qc = useQueryClient()

  const mutation = useMutation<Folder, unknown, CreateFolderInput, Context>({
    mutationFn: async (input) => {
      const raw = await api.post('folders', { json: input }).json()
      return folderSchema.parse(raw)
    },
    onMutate: async (input) => {
      const key = folderKeys.inDataroom(input.dataroomId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<Folder[]>(key)
      const tempId = `temp-${crypto.randomUUID()}`
      const now = new Date().toISOString()
      const optimistic: Folder = {
        id: tempId,
        dataroomId: input.dataroomId,
        parentId: input.parentId,
        name: input.name,
        childFolderCount: 0,
        fileCount: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      qc.setQueryData<Folder[]>(key, [...(prev ?? []), optimistic])
      return { prev, tempId }
    },
    onError: (err, input, ctx) => {
      if (ctx?.prev) qc.setQueryData(folderKeys.inDataroom(input.dataroomId), ctx.prev)
      const cached = qc.getQueryData<Folder[]>(folderKeys.inDataroom(input.dataroomId)) ?? []
      const existing = cached.find(
        (f) => f.parentId === input.parentId && f.name === input.name && !f.deletedAt,
      )
      handleMutationError(err, 'Failed to create folder', {
        entity: 'folder',
        attemptedName: input.name,
        onKeepBoth: (newName) => mutation.mutate({ ...input, name: newName }),
        onReplace: existing
          ? async () => {
              await api.delete(`folders/${existing.id}`).json()
              void qc.invalidateQueries({ queryKey: folderKeys.inDataroom(input.dataroomId) })
              mutation.mutate(input)
            }
          : undefined,
      })
    },
    onSuccess: (created, input, ctx) => {
      qc.setQueryData<Folder[]>(folderKeys.inDataroom(input.dataroomId), (curr) =>
        (curr ?? []).map((f) => (f.id === ctx?.tempId ? created : f)),
      )
    },
    onSettled: (_data, _err, input) => {
      void qc.invalidateQueries({ queryKey: folderKeys.inDataroom(input.dataroomId) })
    },
  })
  return mutation
}
