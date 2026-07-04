import { type Share, shareResponse, shareSchema } from '@dataroom/shared'
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
  return useMutation<Share>({
    mutationFn: async () => {
      const raw = await api.post(`files/${fileId}/share`).json()
      return shareSchema.parse(raw)
    },
    onSuccess: (share) => {
      qc.setQueryData(shareKeys.detail(fileId), share)
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to create share link'))
    },
  })
}

export function useRevokeShare(fileId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<void>({
    mutationFn: async () => {
      await api.delete(`files/${fileId}/share`)
    },
    onSuccess: () => {
      qc.setQueryData(shareKeys.detail(fileId), null)
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to revoke share'))
    },
  })
}
