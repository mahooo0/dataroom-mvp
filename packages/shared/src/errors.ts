import { z } from 'zod'

export const ERROR_CODES = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'DATAROOM_NAME_TAKEN',
  'FOLDER_NAME_TAKEN',
  'FILE_NAME_TAKEN',
  'FILE_TOO_LARGE',
  'INVALID_MIME_TYPE',
  'UPLOAD_INCOMPLETE',
  'STORAGE_ERROR',
  'INTERNAL_ERROR',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export const apiErrorSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})

export type ApiError = z.infer<typeof apiErrorSchema>

export class DataroomApiError extends Error {
  readonly code: ErrorCode
  readonly statusCode: number
  readonly details?: Record<string, unknown>

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'DataroomApiError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }

  toJSON(): ApiError {
    return { code: this.code, message: this.message, details: this.details }
  }
}

export const errorStatusFor = (code: ErrorCode): number => {
  switch (code) {
    case 'UNAUTHORIZED':
      return 401
    case 'FORBIDDEN':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'VALIDATION_FAILED':
    case 'INVALID_MIME_TYPE':
    case 'FILE_TOO_LARGE':
    case 'UPLOAD_INCOMPLETE':
      return 400
    case 'DATAROOM_NAME_TAKEN':
    case 'FOLDER_NAME_TAKEN':
    case 'FILE_NAME_TAKEN':
      return 409
    case 'STORAGE_ERROR':
    case 'INTERNAL_ERROR':
      return 500
    default:
      return 500
  }
}
