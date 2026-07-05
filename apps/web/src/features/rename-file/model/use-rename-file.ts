import { type FileRecord, fileSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fileKeys } from '@/entities/file'
import { ApiFailure, useApi } from '@/shared/api/client'
import { handleMutationError } from '@/shared/lib/handle-mutation-error'

interface Vars {
  id: string
  folderId: string
  name: string
}

interface Context {
  prev?: FileRecord[]
}

export function useRenameFile() {
  const api = useApi()
  const qc = useQueryClient()

  const mutation = useMutation<FileRecord, unknown, Vars, Context>({
    mutationFn: async ({ id, folderId, name }) => {
      const cached = qc.getQueryData<FileRecord[]>(fileKeys.inFolder(folderId)) ?? []
      if (cached.some((f) => f.id !== id && f.name === name && !f.deletedAt)) {
        throw new ApiFailure(
          {
            code: 'FILE_NAME_TAKEN',
            message: 'A file with that name already exists',
          },
          409,
        )
      }
      const raw = await api.patch(`files/${id}`, { json: { name } }).json()
      return fileSchema.parse(raw)
    },
    onMutate: async ({ id, folderId, name }) => {
      const key = fileKeys.inFolder(folderId)
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<FileRecord[]>(key)
      qc.setQueryData<FileRecord[]>(key, (curr) =>
        (curr ?? []).map((f) =>
          f.id === id ? { ...f, name, updatedAt: new Date().toISOString() } : f,
        ),
      )
      return { prev }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(fileKeys.inFolder(vars.folderId), ctx.prev)
      const cached = qc.getQueryData<FileRecord[]>(fileKeys.inFolder(vars.folderId)) ?? []
      const siblings = cached.filter((f) => f.id !== vars.id && !f.deletedAt)
      handleMutationError(err, 'Failed to rename file', {
        entity: 'file',
        attemptedName: vars.name,
        takenNames: siblings.map((f) => f.name),
        onKeepBoth: (newName) => mutation.mutate({ ...vars, name: newName }),
      })
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: fileKeys.inFolder(vars.folderId) })
    },
  })
  return mutation
}
