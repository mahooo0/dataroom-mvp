import type { DataroomIconKey } from '@dataroom/shared'
import { create } from 'zustand'

interface IconFilterState {
  iconKey: DataroomIconKey | null
  setIconKey: (key: DataroomIconKey | null) => void
}

export const useIconFilterStore = create<IconFilterState>((set) => ({
  iconKey: null,
  setIconKey: (iconKey) => set({ iconKey }),
}))
