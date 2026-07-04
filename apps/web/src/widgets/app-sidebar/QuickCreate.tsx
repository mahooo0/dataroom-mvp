import { PlusCircle } from 'lucide-react'
import { useState } from 'react'
import { CreateDataroomDialog } from '@/features/create-dataroom'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/animate-ui/components/radix/sidebar'

export function QuickCreate() {
  const [open, setOpen] = useState(false)

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New dataroom"
              className="w-full justify-start"
              onClick={() => setOpen(true)}
            >
              <PlusCircle className="size-4" />
              <span className="font-medium">New dataroom</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
      <CreateDataroomDialog open={open} onOpenChange={setOpen} />
    </SidebarGroup>
  )
}
