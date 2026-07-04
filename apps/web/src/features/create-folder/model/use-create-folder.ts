import { type CreateFolderInput, type Folder, folderSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { folderKeys } from '@/entities/folder'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'

interface Context {
  prev?: Folder[]
  tempId: string
}

export function useCreateFolder() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<Folder, unknown, CreateFolderInput, Context>({
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
      toast.error(apiErrorMessage(err, 'Failed to create folder'))
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
}
