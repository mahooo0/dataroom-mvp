import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useApi } from '@/shared/api/client'
import { folderKeys } from './keys'

const responseSchema = z.object({
  folderCount: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
})

export function useFolderDescendantCounts(folderId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: folderId
      ? ([...folderKeys.all, 'descendant-counts', folderId] as const)
      : (['folders', 'descendant-counts', 'noop'] as const),
    queryFn: async () => {
      const raw = await api.get(`folders/${folderId}/descendant-counts`).json()
      return responseSchema.parse(raw)
    },
    enabled: !!folderId,
    staleTime: 30_000,
  })
}
