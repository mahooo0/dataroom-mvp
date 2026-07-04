import { Link, useLocation } from '@tanstack/react-router'
import { Settings, Trash2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import { APP_CONFIG } from '@/shared/config/app-config'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/shared/ui/animate-ui/components/radix/sidebar'
import { BrandMark } from '@/shared/ui/brand-mark'
import { NavUser } from './NavUser'
import { QuickCreate } from './QuickCreate'
import { SidebarDatarooms } from './SidebarDatarooms'
import { StorageMeter } from './StorageMeter'

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { pathname } = useLocation()
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={APP_CONFIG.name}>
              <Link to="/datarooms" className="flex items-center gap-2">
                <div className="relative flex aspect-square size-8 items-center justify-center overflow-hidden rounded-lg bg-[linear-gradient(to_bottom_right,rgba(137,190,255,0.35),rgba(137,190,255,0.95))] text-neutral-900 ring-1 ring-[#89BEFF]/40">
                  <BrandMark className="relative z-10 size-4" />
                </div>
                <span className="truncate text-sm font-semibold leading-tight group-data-[collapsible=icon]:hidden">
                  {APP_CONFIG.name}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <QuickCreate />
        <SidebarDatarooms />
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Trash" isActive={pathname.startsWith('/trash')}>
                  <Link to="/trash">
                    <Trash2 />
                    <span>Trash</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Settings"
                  isActive={pathname.startsWith('/settings')}
                >
                  <Link to="/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <StorageMeter />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
