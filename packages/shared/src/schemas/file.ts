import { z } from 'zod'
import { idSchema, nameSchema, timestampsSchema } from './common'

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024
export const ACCEPTED_MIME = 'application/pdf'

export const fileStatusSchema = z.enum(['pending', 'ready', 'failed'])
export type FileStatus = z.infer<typeof fileStatusSchema>

export const fileSchema = z
  .object({
    id: idSchema,
    folderId: idSchema,
    name: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().nonnegative(),
    s3Key: z.string(),
    status: fileStatusSchema,
  })
  .merge(timestampsSchema)

export type FileRecord = z.infer<typeof fileSchema>

export const uploadInitInput = z.object({
  folderId: idSchema,
  name: nameSchema,
  mimeType: z.literal(ACCEPTED_MIME),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
})
export type UploadInitInput = z.infer<typeof uploadInitInput>

export const uploadInitResponse = z.object({
  fileId: idSchema,
  uploadUrl: z.string().url(),
  s3Key: z.string(),
  expiresIn: z.number().int().positive(),
})
export type UploadInitResponse = z.infer<typeof uploadInitResponse>

export const uploadCompleteResponse = z.object({
  file: fileSchema,
})
export type UploadCompleteResponse = z.infer<typeof uploadCompleteResponse>

export const renameFileInput = z.object({ name: nameSchema })
export type RenameFileInput = z.infer<typeof renameFileInput>

export const moveFileInput = z.object({ folderId: idSchema })
export type MoveFileInput = z.infer<typeof moveFileInput>

export const downloadUrlResponse = z.object({
  url: z.string().url(),
  expiresIn: z.number().int().positive(),
})
export type DownloadUrlResponse = z.infer<typeof downloadUrlResponse>

export const fileListResponse = z.object({ files: z.array(fileSchema) })
export type FileListResponse = z.infer<typeof fileListResponse>
