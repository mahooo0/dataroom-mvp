export const shareKeys = {
  all: ['file-shares'] as const,
  detail: (fileId: string) => [...shareKeys.all, 'detail', fileId] as const,
}
