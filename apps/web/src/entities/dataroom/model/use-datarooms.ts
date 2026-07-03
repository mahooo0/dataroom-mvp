import { type Dataroom, dataroomListResponse } from '@dataroom/shared'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/shared/api/client'
import { dataroomKeys } from './keys'

export function useDatarooms() {
  const api = useApi()
  return useQuery({
    queryKey: dataroomKeys.list(),
    queryFn: async () => {
      const raw = await api.get('datarooms').json()
      return dataroomListResponse.parse(raw).datarooms
    },
  })
}

export function findDataroom(list: Dataroom[] | undefined, id: string): Dataroom | undefined {
  return list?.find((d) => d.id === id)
}
