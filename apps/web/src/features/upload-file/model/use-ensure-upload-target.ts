import { type Folder, folderSchema } from '@dataroom/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { childrenOf, folderKeys } from '@/entities/folder'
import { useApi } from '@/shared/api/client'

const ROOT_FOLDER_NAME = 'Files'

/**
 * Resolve an upload target folder for a dataroom-root context.
 *
 * If a folderId is already selected, we're done. Otherwise we prefer the
 * first non-deleted root folder — matching what Google Drive does when you
 * drop into a workspace with a Documents/Files folder. If the dataroom is
 * empty, we lazy-create one called "Files" so the user never sees a
 * disabled Upload button.
 *
 * Concurrent callers share the same in-flight creation to avoid races.
 */
export function useEnsureUploadTarget(dataroomId: string) {
  const api = useApi()
  const qc = useQueryClient()
  const inFlight = useRef<Promise<string> | null>(null)

  return useCallback(
    async (folderId: string | null): Promise<string> => {
      if (folderId) return folderId
      const key = folderKeys.inDataroom(dataroomId)
      const folders = qc.getQueryData<Folder[]>(key) ?? []
      const rootFolders = childrenOf(folders, null).filter((f) => !f.deletedAt)
      const firstRoot = rootFolders[0]
      if (firstRoot) return firstRoot.id

      if (inFlight.current) return inFlight.current
      const creation = (async () => {
        const raw = await api
          .post('folders', {
            json: { dataroomId, parentId: null, name: ROOT_FOLDER_NAME },
          })
          .json()
        const created = folderSchema.parse(raw)
        qc.setQueryData<Folder[]>(key, (curr) => [...(curr ?? []), created])
        void qc.invalidateQueries({ queryKey: key })
        return created.id
      })()
      inFlight.current = creation
      try {
        return await creation
      } finally {
        inFlight.current = null
      }
    },
    [api, qc, dataroomId],
  )
}
