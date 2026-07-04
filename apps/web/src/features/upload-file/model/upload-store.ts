import { create } from 'zustand'

export type UploadState = 'uploading' | 'error' | 'ready'

export interface UploadSession {
  id: string
  folderId: string
  fileId?: string
  name: string
  size: number
  progress: number
  state: UploadState
  error?: string
  file: File
  abort?: () => void
}

interface UploadStore {
  sessions: UploadSession[]
  add: (session: UploadSession) => void
  update: (id: string, patch: Partial<UploadSession>) => void
  remove: (id: string) => void
  clearFolder: (folderId: string) => void
  getForFolder: (folderId: string) => UploadSession[]
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  sessions: [],
  add: (session) => set((s) => ({ sessions: [...s.sessions, session] })),
  update: (id, patch) =>
    set((s) => ({
      sessions: s.sessions.map((sess) => (sess.id === id ? { ...sess, ...patch } : sess)),
    })),
  remove: (id) => set((s) => ({ sessions: s.sessions.filter((sess) => sess.id !== id) })),
  clearFolder: (folderId) =>
    set((s) => ({ sessions: s.sessions.filter((sess) => sess.folderId !== folderId) })),
  getForFolder: (folderId) => get().sessions.filter((sess) => sess.folderId === folderId),
}))
