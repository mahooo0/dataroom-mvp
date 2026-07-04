import { type FileRecord, fileSchema } from '@dataroom/shared'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useApi } from '@/shared/api/client'
import { fileKeys } from './keys'

const filesResponse = z.object({ files: z.array(fileSchema) })

export function useFilesInFolder(folderId: string | null | undefined) {
  const api = useApi()
  return useQuery<FileRecord[]>({
    queryKey: folderId ? fileKeys.inFolder(folderId) : ['files', 'noop'],
    queryFn: async () => {
      const raw = await api.get(`folders/${folderId}/files`).json()
      return filesResponse.parse(raw).files
    },
    enabled: !!folderId,
  })
}
