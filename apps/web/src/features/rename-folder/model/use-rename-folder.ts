import { type Folder, folderSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { folderKeys } from '@/entities/folder'
import { ApiFailure, useApi } from '@/shared/api/client'
import { handleMutationError } from '@/shared/lib/handle-mutation-error'

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

  const mutation = useMutation<Folder, unknown, Vars, Context>({
    mutationFn: async ({ id, dataroomId, name }) => {
      const cached = qc.getQueryData<Folder[]>(folderKeys.inDataroom(dataroomId)) ?? []
      const self = cached.find((f) => f.id === id)
      if (
        self &&
        cached.some(
          (f) => f.id !== id && f.parentId === self.parentId && f.name === name && !f.deletedAt,
        )
      ) {
        throw new ApiFailure(
          {
            code: 'FOLDER_NAME_TAKEN',
            message: 'A folder with that name already exists here',
          },
          409,
        )
      }
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
      const cached = qc.getQueryData<Folder[]>(folderKeys.inDataroom(vars.dataroomId)) ?? []
      const self = cached.find((f) => f.id === vars.id)
      const siblings = cached.filter(
        (f) => f.id !== vars.id && f.parentId === self?.parentId && !f.deletedAt,
      )
      handleMutationError(err, 'Failed to rename folder', {
        entity: 'folder',
        attemptedName: vars.name,
        takenNames: siblings.map((f) => f.name),
        onKeepBoth: (newName) => mutation.mutate({ ...vars, name: newName }),
      })
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: folderKeys.inDataroom(vars.dataroomId) })
    },
  })
  return mutation
}
