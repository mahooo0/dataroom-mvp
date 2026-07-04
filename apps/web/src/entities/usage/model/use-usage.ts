import { useAuth } from '@clerk/react'
import { usageResponse } from '@dataroom/shared'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/shared/api/client'

export const usageKeys = {
  all: ['me', 'usage'] as const,
}

export function useUsage() {
  const api = useApi()
  const { isLoaded, isSignedIn } = useAuth()
  return useQuery({
    queryKey: usageKeys.all,
    queryFn: async () => {
      const raw = await api.get('me/usage').json()
      return usageResponse.parse(raw)
    },
    enabled: isLoaded && isSignedIn,
    staleTime: 30_000,
  })
}
