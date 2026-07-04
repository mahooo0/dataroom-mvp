export const shareKeys = {
  all: ['shares'] as const,
  detail: (dataroomId: string) => [...shareKeys.all, 'detail', dataroomId] as const,
}
