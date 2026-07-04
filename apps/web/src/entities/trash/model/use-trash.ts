import { trashListResponse } from '@dataroom/shared'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/shared/api/client'
import { trashKeys } from './keys'

export function useTrash() {
  const api = useApi()
  return useQuery({
    queryKey: trashKeys.list(),
    queryFn: async () => {
      const raw = await api.get('trash').json()
      return trashListResponse.parse(raw).items
    },
    staleTime: 30_000,
  })
}
