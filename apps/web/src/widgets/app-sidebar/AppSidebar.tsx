import { Link } from '@tanstack/react-router'
import type { ComponentProps } from 'react'
import { APP_CONFIG } from '@/shared/config/app-config'
import { navItems as NAV_ITEMS_LIST } from '@/shared/config/nav-items'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/shared/ui/animate-ui/components/radix/sidebar'
import { BrandMark } from '@/shared/ui/brand-mark'
import { NavMain } from './NavMain'
import { NavUser } from './NavUser'
import { QuickCreate } from './QuickCreate'
import { SidebarDatarooms } from './SidebarDatarooms'
import { StorageMeter } from './StorageMeter'

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
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
                <span className="truncate text-sm font-semibold leading-tight">
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
        <NavMain items={NAV_ITEMS_LIST} />
      </SidebarContent>
      <SidebarFooter>
        <StorageMeter />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
