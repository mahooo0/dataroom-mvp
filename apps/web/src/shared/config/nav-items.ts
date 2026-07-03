import { FolderOpen, History, type LucideIcon, Settings, Trash2 } from 'lucide-react'

export interface NavSubItem {
  title: string
  url: string
  icon?: LucideIcon
  comingSoon?: boolean
  newTab?: boolean
  isNew?: boolean
}

export interface NavMainItem {
  title: string
  url: string
  icon?: LucideIcon
  subItems?: NavSubItem[]
  comingSoon?: boolean
  newTab?: boolean
  isNew?: boolean
}

export interface NavGroup {
  id: number
  label?: string
  items: NavMainItem[]
}

export const navItems: NavGroup[] = [
  {
    id: 1,
    items: [
      {
        title: 'Datarooms',
        url: '/datarooms',
        icon: FolderOpen,
      },
      {
        title: 'Trash',
        url: '/trash',
        icon: Trash2,
      },
      {
        title: 'Audit log',
        url: '/audit-log',
        icon: History,
        isNew: true,
      },
      {
        title: 'Settings',
        url: '/settings',
        icon: Settings,
      },
    ],
  },
]
