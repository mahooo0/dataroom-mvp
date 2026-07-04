import { create } from 'zustand'

export type NameConflictEntity = 'dataroom' | 'folder' | 'file'

export interface NameConflictRequest {
  entity: NameConflictEntity
  attemptedName: string
  suggestion: string
  onKeepBoth: (newName: string) => void
  onReplace?: () => void | Promise<void>
}

interface NameConflictState {
  current: NameConflictRequest | null
  open: (req: NameConflictRequest) => void
  close: () => void
}

export const useNameConflictStore = create<NameConflictState>((set) => ({
  current: null,
  open: (req) => set({ current: req }),
  close: () => set({ current: null }),
}))
