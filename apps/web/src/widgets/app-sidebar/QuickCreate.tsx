import { FolderPlus, PlusCircle, Upload } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/animate-ui/components/radix/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/ui/animate-ui/components/radix/sidebar'

export function QuickCreate() {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton tooltip="Quick create" className="w-full justify-start">
                  <PlusCircle className="size-4" />
                  <span className="font-medium">Quick create</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right" className="min-w-52">
                <DropdownMenuLabel>Create</DropdownMenuLabel>
                <DropdownMenuItem>
                  <FolderPlus className="size-4" />
                  New dataroom
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FolderPlus className="size-4" />
                  New folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Upload className="size-4" />
                  Upload files
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
