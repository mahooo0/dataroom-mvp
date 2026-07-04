export const fileKeys = {
  all: ['files'] as const,
  inFolder: (folderId: string) => [...fileKeys.all, 'folder', folderId] as const,
  downloadUrl: (fileId: string) => [...fileKeys.all, 'download-url', fileId] as const,
}
