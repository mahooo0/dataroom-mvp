import { useAuth } from '@clerk/react'
import { type DataroomIconKey, searchResponse } from '@dataroom/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useApi } from '@/shared/api/client'

export function useSearch(query: string, iconKey: DataroomIconKey | null) {
  const api = useApi()
  const { isLoaded, isSignedIn } = useAuth()
  const q = query.trim()
  return useQuery({
    queryKey: ['search', q, iconKey],
    queryFn: async () => {
      const search: Record<string, string> = {}
      if (q) search.q = q
      if (iconKey) search.iconKey = iconKey
      const raw = await api.get('search', { searchParams: search }).json()
      return searchResponse.parse(raw)
    },
    enabled: isLoaded && isSignedIn,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  })
}
