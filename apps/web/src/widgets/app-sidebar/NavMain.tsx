import { Link, useLocation } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import type { NavGroup, NavMainItem } from '@/shared/config/nav-items'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/animate-ui/components/radix/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/shared/ui/animate-ui/components/radix/sidebar'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/ui/animate-ui/primitives/radix/collapsible'

interface NavMainProps {
  items: readonly NavGroup[]
}

const IsComingSoon = () => (
  <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
    Soon
  </span>
)

const IsNew = () => (
  <span className="ml-auto rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
    New
  </span>
)

function NavItemExpanded({
  item,
  isActive,
  isSubmenuOpen,
}: {
  item: NavMainItem
  isActive: (url: string, subItems?: NavMainItem['subItems']) => boolean
  isSubmenuOpen: (subItems?: NavMainItem['subItems']) => boolean
}) {
  return (
    <Collapsible asChild defaultOpen={isSubmenuOpen(item.subItems)} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          {item.subItems ? (
            <SidebarMenuButton
              disabled={item.comingSoon}
              isActive={isActive(item.url, item.subItems)}
              tooltip={item.title}
              data-value={item.url}
            >
              {item.icon && <item.icon />}
              <span>{item.title}</span>
              {item.comingSoon ? <IsComingSoon /> : item.isNew ? <IsNew /> : null}
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            </SidebarMenuButton>
          ) : (
            <SidebarMenuButton
              asChild
              aria-disabled={item.comingSoon}
              isActive={isActive(item.url)}
              tooltip={item.title}
              data-value={item.url}
            >
              {item.comingSoon ? (
                <span className="cursor-not-allowed opacity-50">
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <IsComingSoon />
                </span>
              ) : (
                <Link to={item.url} target={item.newTab ? '_blank' : undefined}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  {item.isNew ? <IsNew /> : null}
                </Link>
              )}
            </SidebarMenuButton>
          )}
        </CollapsibleTrigger>
        {item.subItems ? (
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.subItems.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    asChild
                    aria-disabled={subItem.comingSoon}
                    isActive={isActive(subItem.url)}
                  >
                    {subItem.comingSoon ? (
                      <span className="cursor-not-allowed opacity-50">
                        {subItem.icon && <subItem.icon />}
                        <span>{subItem.title}</span>
                        <IsComingSoon />
                      </span>
                    ) : (
                      <Link to={subItem.url} target={subItem.newTab ? '_blank' : undefined}>
                        {subItem.icon && <subItem.icon />}
                        <span>{subItem.title}</span>
                        {subItem.isNew ? <IsNew /> : null}
                      </Link>
                    )}
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        ) : null}
      </SidebarMenuItem>
    </Collapsible>
  )
}

function NavItemCollapsed({
  item,
  isActive,
}: {
  item: NavMainItem
  isActive: (url: string, subItems?: NavMainItem['subItems']) => boolean
}) {
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            disabled={item.comingSoon}
            tooltip={item.title}
            isActive={isActive(item.url, item.subItems)}
            data-value={item.url}
          >
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            <ChevronRight />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="min-w-48 space-y-1">
          {item.subItems?.map((subItem) => (
            // biome-ignore lint/suspicious/noExplicitAny: animate-ui DropdownMenuItem accepts asChild at runtime but doesn't type it
            <DropdownMenuItem key={subItem.title} {...({ asChild: true } as any)}>
              <SidebarMenuSubButton
                asChild
                className="focus-visible:ring-0"
                aria-disabled={subItem.comingSoon}
                isActive={isActive(subItem.url)}
              >
                {subItem.comingSoon ? (
                  <span className="cursor-not-allowed opacity-50">
                    {subItem.icon && <subItem.icon />}
                    <span>{subItem.title}</span>
                  </span>
                ) : (
                  <Link to={subItem.url} target={subItem.newTab ? '_blank' : undefined}>
                    {subItem.icon && <subItem.icon />}
                    <span>{subItem.title}</span>
                  </Link>
                )}
              </SidebarMenuSubButton>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

export function NavMain({ items }: NavMainProps) {
  const { pathname } = useLocation()
  const { state, isMobile } = useSidebar()

  const isItemActive = (url: string, subItems?: NavMainItem['subItems']) => {
    if (subItems?.length) return subItems.some((s) => pathname.startsWith(s.url))
    return pathname === url || pathname.startsWith(`${url}/`)
  }

  const isSubmenuOpen = (subItems?: NavMainItem['subItems']) =>
    subItems?.some((s) => pathname.startsWith(s.url)) ?? false

  return (
    <>
      {items.map((group) => (
        <SidebarGroup key={group.id}>
          {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
          <SidebarGroupContent className="flex flex-col gap-1">
            <SidebarMenu>
              {group.items.map((item) => {
                if (state === 'collapsed' && !isMobile) {
                  if (!item.subItems) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          aria-disabled={item.comingSoon}
                          tooltip={item.title}
                          isActive={isItemActive(item.url)}
                          disabled={item.comingSoon}
                          data-value={item.url}
                        >
                          {item.comingSoon ? (
                            <span>
                              {item.icon && <item.icon />}
                              <span>{item.title}</span>
                            </span>
                          ) : (
                            <Link to={item.url} target={item.newTab ? '_blank' : undefined}>
                              {item.icon && <item.icon />}
                              <span>{item.title}</span>
                            </Link>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  }
                  return <NavItemCollapsed key={item.title} item={item} isActive={isItemActive} />
                }
                return (
                  <NavItemExpanded
                    key={item.title}
                    item={item}
                    isActive={isItemActive}
                    isSubmenuOpen={isSubmenuOpen}
                  />
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
