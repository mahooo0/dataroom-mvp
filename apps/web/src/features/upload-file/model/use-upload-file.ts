import {
  ACCEPTED_MIME,
  type FileRecord,
  MAX_FILE_SIZE_BYTES,
  uploadCompleteResponse,
  uploadInitResponse,
} from '@dataroom/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { fileKeys } from '@/entities/file'
import { usageKeys } from '@/entities/usage'
import { useApi } from '@/shared/api/client'
import { apiErrorMessage, toApiFailure } from '@/shared/lib/api-error'
import { useNameConflictStore } from '@/shared/lib/name-conflict-store'
import { suggestNextName } from '@/shared/lib/next-name'
import { type UploadSession, useUploadStore } from './upload-store'

function putWithProgress(
  uploadUrl: string,
  file: File,
  onProgress: (fraction: number) => void,
): { promise: Promise<void>; abort: () => void } {
  const xhr = new XMLHttpRequest()
  const promise = new Promise<void>((resolve, reject) => {
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total)
      }
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed with status ${xhr.status}`))
    })
    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', ACCEPTED_MIME)
    xhr.send(file)
  })
  return { promise, abort: () => xhr.abort() }
}

export function useUploadFile() {
  const api = useApi()
  const qc = useQueryClient()
  const store = useUploadStore()

  const runUpload = useCallback(
    async (session: UploadSession) => {
      let initRaw: unknown
      try {
        initRaw = await api
          .post('files/init', {
            json: {
              folderId: session.folderId,
              name: session.name,
              mimeType: ACCEPTED_MIME,
              sizeBytes: session.size,
            },
          })
          .json()
      } catch (err) {
        const failure = toApiFailure(err)
        if (failure?.code === 'FILE_NAME_TAKEN') {
          useUploadStore.getState().update(session.id, {
            state: 'error',
            error: 'A file with that name already exists',
            abort: undefined,
          })
          useNameConflictStore.getState().open({
            entity: 'file',
            attemptedName: session.name,
            suggestion: suggestNextName(session.name),
            onKeepBoth: (newName) => {
              useUploadStore.getState().update(session.id, {
                name: newName,
                state: 'uploading',
                error: undefined,
                progress: 0,
                fileId: undefined,
              })
              void runUpload({ ...session, name: newName })
            },
            onReplace: async () => {
              // Trash the existing file so the partial unique index frees the name,
              // then re-init this session under the same name.
              const cached = qc.getQueryData<FileRecord[]>(fileKeys.inFolder(session.folderId))
              const existing = cached?.find((f) => f.name === session.name && !f.deletedAt)
              if (!existing) {
                toast.error('Could not find the existing file to replace.')
                return
              }
              try {
                await api.delete(`files/${existing.id}`)
              } catch (err) {
                toast.error(apiErrorMessage(err, 'Failed to replace the existing file'))
                return
              }
              await qc.invalidateQueries({ queryKey: fileKeys.inFolder(session.folderId) })
              useUploadStore.getState().update(session.id, {
                state: 'uploading',
                error: undefined,
                progress: 0,
                fileId: undefined,
              })
              void runUpload(session)
            },
          })
          return
        }
        useUploadStore.getState().update(session.id, {
          state: 'error',
          error: apiErrorMessage(err, 'Upload failed'),
          abort: undefined,
        })
        return
      }
      try {
        const init = uploadInitResponse.parse(initRaw)

        const { promise, abort } = putWithProgress(init.uploadUrl, session.file, (frac) => {
          useUploadStore.getState().update(session.id, { progress: frac })
        })
        useUploadStore.getState().update(session.id, { fileId: init.fileId, abort })
        await promise
        useUploadStore.getState().update(session.id, { progress: 1, abort: undefined })

        let attempt = 0
        while (attempt < 3) {
          try {
            const completeRaw = await api.post(`files/${init.fileId}/complete`).json()
            uploadCompleteResponse.parse(completeRaw)
            break
          } catch (err) {
            attempt++
            if (attempt >= 3) throw err
            await new Promise((r) => setTimeout(r, 300 * 2 ** attempt))
          }
        }

        useUploadStore.getState().update(session.id, { state: 'ready' })
        void qc.invalidateQueries({ queryKey: fileKeys.inFolder(session.folderId) })
        void qc.invalidateQueries({ queryKey: usageKeys.all })
        setTimeout(() => useUploadStore.getState().remove(session.id), 800)
      } catch (err) {
        useUploadStore.getState().update(session.id, {
          state: 'error',
          error: apiErrorMessage(err, 'Upload failed'),
          abort: undefined,
        })
      }
    },
    [api, qc],
  )

  const enqueue = useCallback(
    (files: File[], folderId: string) => {
      for (const file of files) {
        if (file.type !== ACCEPTED_MIME) {
          toast.error(`${file.name} is not a PDF`)
          continue
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.error(`${file.name} exceeds 50 MB limit`)
          continue
        }
        const session: UploadSession = {
          id: crypto.randomUUID(),
          folderId,
          name: file.name,
          size: file.size,
          progress: 0,
          state: 'uploading',
          file,
        }
        store.add(session)
        void runUpload(session)
      }
    },
    [runUpload, store],
  )

  const retry = useCallback(
    (id: string) => {
      const sess = useUploadStore.getState().sessions.find((s) => s.id === id)
      if (!sess) return
      useUploadStore
        .getState()
        .update(id, { state: 'uploading', error: undefined, progress: 0, fileId: undefined })
      void runUpload(sess)
    },
    [runUpload],
  )

  const cancel = useCallback(
    (id: string) => {
      const sess = useUploadStore.getState().sessions.find((s) => s.id === id)
      if (!sess) return
      sess.abort?.()
      if (sess.fileId) {
        void api.delete(`files/${sess.fileId}`).catch(() => {})
      }
      useUploadStore.getState().remove(id)
    },
    [api],
  )

  return { enqueue, retry, cancel }
}
