import { publicDataroomResponse, publicDownloadUrlResponse } from '@dataroom/shared'
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/shared/api/client'

export function usePublicShare(token: string) {
  return useQuery({
    queryKey: ['public-share', token],
    queryFn: async () => {
      const raw = await publicApi.get(`public/share/${token}`).json()
      return publicDataroomResponse.parse(raw)
    },
    retry: 0,
    staleTime: 30_000,
  })
}

export function usePublicDownloadUrl(token: string, fileId: string | null) {
  return useQuery({
    queryKey: ['public-share', token, 'download-url', fileId ?? 'noop'],
    enabled: !!fileId,
    queryFn: async () => {
      const raw = await publicApi.get(`public/share/${token}/files/${fileId}/download-url`).json()
      return publicDownloadUrlResponse.parse(raw)
    },
    staleTime: 4 * 60_000,
  })
}
