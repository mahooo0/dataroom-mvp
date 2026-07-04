import { publicFileResponse } from '@dataroom/shared'
import { useQuery } from '@tanstack/react-query'
import { publicApi } from '@/shared/api/client'

export function usePublicShare(token: string) {
  return useQuery({
    queryKey: ['public-share', token],
    queryFn: async () => {
      const raw = await publicApi.get(`public/share/${token}`).json()
      return publicFileResponse.parse(raw)
    },
    retry: 0,
    staleTime: 4 * 60_000,
  })
}
