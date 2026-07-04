import {
  type Dataroom,
  dataroomSchema,
  type Folder,
  folderChildrenResponse,
  folderSchema,
} from '@dataroom/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { dataroomKeys, useDatarooms } from '@/entities/dataroom'
import { folderKeys } from '@/entities/folder'
import { useUploadFile } from '@/features/upload-file'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage } from '@/shared/lib/api-error'

const DEFAULT_DATAROOM_NAME = 'My files'
const INBOX_FOLDER_NAME = 'Inbox'

/**
 * Google-Drive-style "drop anywhere" upload. Ensures a personal "My files" dataroom
 * with an "Inbox" root folder exists (creating them lazily on first use), then hands
 * the files to the existing upload session store. No progress-tracking here — that's
 * still owned by the standard upload flow.
 */
export function useQuickUpload() {
  const api = useApi()
  const qc = useQueryClient()
  const { data: datarooms } = useDatarooms()
  const { enqueue } = useUploadFile()

  const resolveInboxFolderId = useCallback(async (): Promise<{
    dataroomId: string
    folderId: string
  }> => {
    const existing = datarooms?.find((d) => d.name === DEFAULT_DATAROOM_NAME)
    const dataroom = existing ?? (await createDefaultDataroom(api, qc))

    const folders = await ensureFoldersLoaded(api, qc, dataroom.id)
    const existingInbox = folders.find((f) => f.parentId === null && f.name === INBOX_FOLDER_NAME)
    const inbox = existingInbox ?? (await createInboxFolder(api, qc, dataroom.id))

    return { dataroomId: dataroom.id, folderId: inbox.id }
  }, [api, datarooms, qc])

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return null
      try {
        const target = await resolveInboxFolderId()
        enqueue(files, target.folderId)
        return target
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Could not prepare upload folder'))
        return null
      }
    },
    [enqueue, resolveInboxFolderId],
  )

  return { upload }
}

async function createDefaultDataroom(
  api: ReturnType<typeof useApi>,
  qc: ReturnType<typeof useQueryClient>,
): Promise<Dataroom> {
  await qc.cancelQueries({ queryKey: dataroomKeys.list() })
  try {
    const raw = await api
      .post('datarooms', { json: { name: DEFAULT_DATAROOM_NAME, iconKey: null } })
      .json()
    const parsed = dataroomSchema.parse(raw)
    qc.setQueryData<Dataroom[]>(dataroomKeys.list(), (prev) => [parsed, ...(prev ?? [])])
    return parsed
  } finally {
    qc.invalidateQueries({ queryKey: dataroomKeys.list() })
  }
}

async function ensureFoldersLoaded(
  api: ReturnType<typeof useApi>,
  qc: ReturnType<typeof useQueryClient>,
  dataroomId: string,
): Promise<Folder[]> {
  const cached = qc.getQueryData<Folder[]>(folderKeys.inDataroom(dataroomId))
  if (cached) return cached
  const raw = await api.get(`datarooms/${dataroomId}/folders`).json()
  const parsed = folderChildrenResponse.parse(raw).folders
  qc.setQueryData(folderKeys.inDataroom(dataroomId), parsed)
  return parsed
}

async function createInboxFolder(
  api: ReturnType<typeof useApi>,
  qc: ReturnType<typeof useQueryClient>,
  dataroomId: string,
): Promise<Folder> {
  await qc.cancelQueries({ queryKey: folderKeys.inDataroom(dataroomId) })
  try {
    const raw = await api
      .post('folders', {
        json: { dataroomId, parentId: null, name: INBOX_FOLDER_NAME },
      })
      .json()
    const parsed = folderSchema.parse(raw)
    qc.setQueryData<Folder[]>(folderKeys.inDataroom(dataroomId), (prev) => [
      ...(prev ?? []),
      parsed,
    ])
    return parsed
  } finally {
    qc.invalidateQueries({ queryKey: folderKeys.inDataroom(dataroomId) })
  }
}
