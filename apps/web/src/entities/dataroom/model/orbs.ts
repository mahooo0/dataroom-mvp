import { DATAROOM_ICON_KEYS, type DataroomIconKey } from '@dataroom/shared'

export interface DataroomOrbIcon {
  key: DataroomIconKey
  src: string
  label: string
}

export const DATAROOM_ICONS: readonly DataroomOrbIcon[] = [
  { key: 'orb-1', src: '/orbs/orb-1.webp', label: 'Orb 1' },
  { key: 'orb-2', src: '/orbs/orb-2.webp', label: 'Orb 2' },
  { key: 'orb-3', src: '/orbs/orb-3.webp', label: 'Orb 3' },
  { key: 'eleven-agents', src: '/orbs/eleven-agents.png', label: 'Agents' },
  { key: 'eleven-creative', src: '/orbs/eleven-creative.png', label: 'Creative' },
]

const BY_KEY = new Map(DATAROOM_ICONS.map((i) => [i.key, i]))

export function findIcon(key: string | null | undefined): DataroomOrbIcon | undefined {
  if (!key) return undefined
  return BY_KEY.get(key as DataroomIconKey)
}

export type { DataroomIconKey }
export { DATAROOM_ICON_KEYS }
