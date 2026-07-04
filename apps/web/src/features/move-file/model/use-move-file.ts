import { type FileRecord, fileSchema } from '@dataroom/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fileKeys } from '@/entities/file'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'

interface Vars {
  id: string
  fromFolderId: string
  toFolderId: string
  name: string
}

interface Context {
  prevSource?: FileRecord[]
  prevTarget?: FileRecord[]
  optimistic?: FileRecord
}

export function useMoveFile() {
  const api = useApi()
  const qc = useQueryClient()

  return useMutation<FileRecord, unknown, Vars, Context>({
    mutationFn: async ({ id, toFolderId }) => {
      const raw = await api.patch(`files/${id}/move`, { json: { folderId: toFolderId } }).json()
      return fileSchema.parse(raw)
    },
    onMutate: async ({ id, fromFolderId, toFolderId }) => {
      if (fromFolderId === toFolderId) return {}
      const srcKey = fileKeys.inFolder(fromFolderId)
      const dstKey = fileKeys.inFolder(toFolderId)
      await Promise.all([
        qc.cancelQueries({ queryKey: srcKey }),
        qc.cancelQueries({ queryKey: dstKey }),
      ])
      const prevSource = qc.getQueryData<FileRecord[]>(srcKey)
      const prevTarget = qc.getQueryData<FileRecord[]>(dstKey)
      const moving = prevSource?.find((f) => f.id === id)
      qc.setQueryData<FileRecord[]>(srcKey, (curr) => (curr ?? []).filter((f) => f.id !== id))
      if (moving) {
        qc.setQueryData<FileRecord[]>(dstKey, (curr) => [
          ...(curr ?? []),
          { ...moving, folderId: toFolderId, updatedAt: new Date().toISOString() },
        ])
      }
      return { prevSource, prevTarget, optimistic: moving }
    },
    onError: (err, vars, ctx) => {
      if (ctx?.prevSource !== undefined)
        qc.setQueryData(fileKeys.inFolder(vars.fromFolderId), ctx.prevSource)
      if (ctx?.prevTarget !== undefined)
        qc.setQueryData(fileKeys.inFolder(vars.toFolderId), ctx.prevTarget)
      toast.error(apiErrorMessage(err, `Couldn't move ${vars.name}`))
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: fileKeys.inFolder(vars.fromFolderId) })
      void qc.invalidateQueries({ queryKey: fileKeys.inFolder(vars.toFolderId) })
    },
  })
}
