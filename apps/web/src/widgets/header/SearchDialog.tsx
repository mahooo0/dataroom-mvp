import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { type NavMainItem, navItems } from '@/shared/config/nav-items'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/shared/ui/command'

interface SearchItem {
  group: string
  label: string
  url: string
  icon?: NavMainItem['icon']
  disabled?: boolean
  newTab?: boolean
}

const searchItems: SearchItem[] = navItems.flatMap((group) =>
  group.items.flatMap((item) => {
    if (item.subItems) {
      return item.subItems.map((sub) => ({
        group: group.label ?? 'Navigation',
        label: sub.title,
        url: sub.url,
        icon: item.icon,
        disabled: sub.comingSoon,
        newTab: sub.newTab,
      }))
    }
    return [
      {
        group: group.label ?? 'Navigation',
        label: item.title,
        url: item.url,
        icon: item.icon,
        disabled: item.comingSoon,
        newTab: item.newTab,
      },
    ]
  }),
)

function groupBy(items: SearchItem[]) {
  const groups = [...new Set(items.map((i) => i.group))]
  return groups.map((group) => ({ group, items: items.filter((i) => i.group === group) }))
}

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'j')) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleSelect(item: SearchItem) {
    if (item.disabled) return
    setOpen(false)
    setQuery('')
    if (item.newTab) {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    } else {
      navigate({ to: item.url })
    }
  }

  const renderGroups = (items: SearchItem[]) =>
    groupBy(items).map(({ group, items: groupItems }, idx) => (
      <Fragment key={group}>
        {idx > 0 ? <CommandSeparator /> : null}
        <CommandGroup heading={group}>
          {groupItems.map((item) => (
            <CommandItem
              key={`${group}-${item.url}-${item.label}`}
              value={`${group} ${item.label}`}
              disabled={item.disabled}
              onSelect={() => handleSelect(item)}
              className="cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-selected:bg-sidebar-accent data-selected:text-sidebar-accent-foreground"
            >
              {item.icon ? <item.icon className="size-4" /> : null}
              <span>{item.label}</span>
              {item.disabled ? (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  Soon
                </Badge>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </Fragment>
    ))

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden h-9 items-center gap-2 rounded-lg px-3 text-muted-foreground md:inline-flex md:min-w-52"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left text-sm">Search datarooms, files…</span>
        <kbd className="ml-2 inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-medium text-[10px] text-muted-foreground">
          <span>⌘</span>K
        </kbd>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="md:hidden"
        aria-label="Search"
      >
        <Search className="size-4" />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput
            placeholder="Search datarooms, files, actions…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {renderGroups(searchItems)}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
