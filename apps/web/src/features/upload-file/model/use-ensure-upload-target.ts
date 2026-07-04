import { type Folder, folderSchema } from '@dataroom/shared'
import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { childrenOf, folderKeys } from '@/entities/folder'
import { useApi } from '@/shared/api/client'
import { toApiFailure } from '@/shared/lib/api-error'

const ROOT_FOLDER_NAME = 'Files'

/**
 * Module-level guard so parallel `RootUploadTrigger` and `RootUploadZone`
 * hooks in the same page don't each POST /folders concurrently. Keyed by
 * dataroomId; cleared once the creation settles.
 */
const inFlight = new Map<string, Promise<string>>()

type ApiClient = ReturnType<typeof useApi>

async function pickExistingRoot(qc: QueryClient, dataroomId: string): Promise<string | null> {
  const key = folderKeys.inDataroom(dataroomId)
  const folders = qc.getQueryData<Folder[]>(key) ?? []
  const rootFolders = childrenOf(folders, null).filter((f) => !f.deletedAt)
  return rootFolders[0]?.id ?? null
}

async function refetchFolders(
  api: ApiClient,
  qc: QueryClient,
  dataroomId: string,
): Promise<Folder[]> {
  const raw = await api.get(`datarooms/${dataroomId}/folders`).json()
  const parsed = (raw as { folders: Folder[] }).folders
  qc.setQueryData(folderKeys.inDataroom(dataroomId), parsed)
  return parsed
}

async function createOrRecover(
  api: ApiClient,
  qc: QueryClient,
  dataroomId: string,
): Promise<string> {
  try {
    const raw = await api
      .post('folders', {
        json: { dataroomId, parentId: null, name: ROOT_FOLDER_NAME },
      })
      .json()
    const created = folderSchema.parse(raw)
    qc.setQueryData<Folder[]>(folderKeys.inDataroom(dataroomId), (curr) => [
      ...(curr ?? []),
      created,
    ])
    void qc.invalidateQueries({ queryKey: folderKeys.inDataroom(dataroomId) })
    return created.id
  } catch (err) {
    // A prior "Files" folder that was soft-deleted still occupies the unique
    // name slot only until purged from Trash — but a concurrent tab may also
    // have won the create race. Either way: refetch and use whatever exists.
    const failure = toApiFailure(err)
    if (failure?.code === 'FOLDER_NAME_TAKEN') {
      const folders = await refetchFolders(api, qc, dataroomId)
      const alive = childrenOf(folders, null).find(
        (f) => !f.deletedAt && f.name === ROOT_FOLDER_NAME,
      )
      if (alive) return alive.id
      const anyAlive = childrenOf(folders, null).find((f) => !f.deletedAt)
      if (anyAlive) return anyAlive.id
    }
    throw err
  }
}

/**
 * Resolve an upload target folder for a dataroom-root context.
 *
 * If a folderId is already selected, we're done. Otherwise we prefer the
 * first non-deleted root folder — matching what Google Drive does when you
 * drop into a workspace with a Documents/Files folder. If the dataroom is
 * empty, we lazy-create one called "Files" so the user never sees a
 * disabled Upload button.
 */
export function useEnsureUploadTarget(dataroomId: string) {
  const api = useApi()
  const qc = useQueryClient()

  return useCallback(
    async (folderId: string | null): Promise<string> => {
      if (folderId) return folderId
      const existing = await pickExistingRoot(qc, dataroomId)
      if (existing) return existing

      const pending = inFlight.get(dataroomId)
      if (pending) return pending

      const creation = createOrRecover(api, qc, dataroomId).finally(() => {
        inFlight.delete(dataroomId)
      })
      inFlight.set(dataroomId, creation)
      return creation
    },
    [api, qc, dataroomId],
  )
}
