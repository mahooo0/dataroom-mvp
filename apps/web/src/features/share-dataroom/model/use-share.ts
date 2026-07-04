import { type Share, shareResponse, shareSchema } from '@dataroom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { shareKeys } from './keys'

export function useShare(dataroomId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: dataroomId ? shareKeys.detail(dataroomId) : shareKeys.all,
    enabled: !!dataroomId,
    queryFn: async () => {
      const raw = await api.get(`datarooms/${dataroomId}/share`).json()
      return shareResponse.parse(raw).share
    },
    staleTime: 30_000,
  })
}

export function useCreateShare(dataroomId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Share>({
    mutationFn: async () => {
      const raw = await api.post(`datarooms/${dataroomId}/share`).json()
      return shareSchema.parse(raw)
    },
    onSuccess: (share) => {
      qc.setQueryData(shareKeys.detail(dataroomId), share)
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to create share link'))
    },
  })
}

export function useRevokeShare(dataroomId: string) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<void>({
    mutationFn: async () => {
      await api.delete(`datarooms/${dataroomId}/share`)
    },
    onSuccess: () => {
      qc.setQueryData(shareKeys.detail(dataroomId), null)
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, 'Failed to revoke share'))
    },
  })
}
