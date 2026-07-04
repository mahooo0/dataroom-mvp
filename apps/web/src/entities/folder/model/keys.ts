export const folderKeys = {
  all: ['folders'] as const,
  inDataroom: (dataroomId: string) => [...folderKeys.all, 'dataroom', dataroomId] as const,
}
