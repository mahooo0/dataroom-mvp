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
const PERSONAL_DATAROOM_STORAGE_KEY = 'dataroom.personal-inbox-id.v1'

/**
 * Persist the "personal" dataroom id in localStorage instead of matching by
 * name string. Rename by the user then no longer silently spawns a duplicate
 * on next quick-upload — the id lookup fails, we verify against the server,
 * and only fall back to creating a fresh personal dataroom if the tracked one
 * really is gone.
 */
function readPersonalId(): string | null {
  try {
    return localStorage.getItem(PERSONAL_DATAROOM_STORAGE_KEY)
  } catch {
    return null
  }
}
function writePersonalId(id: string): void {
  try {
    localStorage.setItem(PERSONAL_DATAROOM_STORAGE_KEY, id)
  } catch {
    /* private mode / storage disabled — recompute next time */
  }
}

/**
 * Google-Drive-style "drop anywhere" upload. Resolves the user's personal
 * dataroom + its Inbox folder, creating both lazily on first use. No
 * progress-tracking here — that's still owned by the standard upload flow.
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
    const trackedId = readPersonalId()
    let personal: Dataroom | undefined = trackedId
      ? datarooms?.find((d) => d.id === trackedId)
      : undefined

    if (!personal) {
      personal = await createDefaultDataroom(api, qc)
      writePersonalId(personal.id)
    }

    const folders = await ensureFoldersLoaded(api, qc, personal.id)
    const inbox =
      folders.find((f) => f.parentId === null && f.name === INBOX_FOLDER_NAME && !f.deletedAt) ??
      (await createInboxFolder(api, qc, personal.id))

    return { dataroomId: personal.id, folderId: inbox.id }
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
