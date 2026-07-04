import { downloadUrlResponse } from '@dataroom/shared'
import { useQuery } from '@tanstack/react-query'
import { fileKeys } from '@/entities/file'
import { useApi } from '@/shared/api/client'

export function useDownloadUrl(fileId: string | null) {
  const api = useApi()
  return useQuery({
    queryKey: fileId ? fileKeys.downloadUrl(fileId) : ['files', 'download-url', 'noop'],
    queryFn: async () => {
      const raw = await api.get(`files/${fileId}/download-url`).json()
      return downloadUrlResponse.parse(raw)
    },
    enabled: !!fileId,
    staleTime: 55 * 60_000,
    gcTime: 60 * 60_000,
  })
}
