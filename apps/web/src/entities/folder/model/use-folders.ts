import { type Folder, folderChildrenResponse } from '@dataroom/shared'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '@/shared/api/client'
import { folderKeys } from './keys'

export function useFolders(dataroomId: string | undefined) {
  const api = useApi()
  return useQuery({
    queryKey: dataroomId ? folderKeys.inDataroom(dataroomId) : ['folders', 'noop'],
    queryFn: async () => {
      const raw = await api.get(`datarooms/${dataroomId}/folders`).json()
      return folderChildrenResponse.parse(raw).folders
    },
    enabled: !!dataroomId,
  })
}

export function findFolder(folders: Folder[] | undefined, id: string | null): Folder | undefined {
  if (!folders || !id) return undefined
  return folders.find((f) => f.id === id)
}
