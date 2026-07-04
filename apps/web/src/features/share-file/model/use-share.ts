import {
  type CreateShareInput,
  DEFAULT_SHARE_TTL_KEY,
  type Share,
  shareResponse,
  shareSchema,
} from '@dataroom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { shareKeys } from './keys'

export function useShare(fileId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: fileId ? shareKeys.detail(fileId) : shareKeys.all,
    enabled: !!fileId,
    queryFn: async () => {
      const raw = await api.get(`files/${fileId}/share`).json()
      return shareResponse.parse(raw).share
    },
    staleTime: 30_000,
  })
}

export function useCreateShare(fileId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<
    Share,
    unknown,
    Partial<CreateShareInput> | undefined,
    { prev: Share | null | undefined }
  >({
    mutationFn: async (input) => {
      const body: CreateShareInput = {
        ttl: input?.ttl ?? DEFAULT_SHARE_TTL_KEY,
        allowDownload: input?.allowDownload ?? false,
      }
      const raw = await api.post(`files/${fileId}/share`, { json: body }).json()
      return shareSchema.parse(raw)
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: shareKeys.detail(fileId) })
      const prev = qc.getQueryData<Share | null>(shareKeys.detail(fileId))
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(shareKeys.detail(fileId), ctx.prev)
      toast.error(apiErrorMessage(err, 'Failed to create share link'))
    },
    onSuccess: (share) => {
      qc.setQueryData(shareKeys.detail(fileId), share)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: shareKeys.detail(fileId) })
    },
  })
}

export function useRevokeShare(fileId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<void, unknown, void, { prev: Share | null | undefined }>({
    mutationFn: async () => {
      await api.delete(`files/${fileId}/share`)
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: shareKeys.detail(fileId) })
      const prev = qc.getQueryData<Share | null>(shareKeys.detail(fileId))
      qc.setQueryData(shareKeys.detail(fileId), null)
      return { prev }
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(shareKeys.detail(fileId), ctx.prev)
      toast.error(apiErrorMessage(err, 'Failed to revoke share'))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: shareKeys.detail(fileId) })
    },
  })
}
