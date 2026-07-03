export const dataroomKeys = {
  all: ['datarooms'] as const,
  list: () => [...dataroomKeys.all, 'list'] as const,
  detail: (id: string) => [...dataroomKeys.all, 'detail', id] as const,
}
