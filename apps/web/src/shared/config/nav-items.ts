import { type LucideIcon, Settings } from 'lucide-react'

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
        title: 'Settings',
        url: '/settings',
        icon: Settings,
      },
    ],
  },
]
