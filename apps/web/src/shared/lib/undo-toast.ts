import { toast } from 'sonner'

interface ShowUndoToastOptions {
  message: string
  onUndo: () => void | Promise<void>
  duration?: number
}

export function showUndoToast({ message, onUndo, duration = 5000 }: ShowUndoToastOptions) {
  toast(message, {
    duration,
    action: {
      label: 'Undo',
      onClick: () => {
        void onUndo()
      },
    },
  })
}
