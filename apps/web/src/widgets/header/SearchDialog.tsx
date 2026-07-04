import { useNavigate } from '@tanstack/react-router'
import { FileText, Folder as FolderIcon, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { DataroomOrb, findIcon } from '@/entities/dataroom'
import { useIconFilterStore, useSearch } from '@/features/search'
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value'
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

export function SearchDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 200)
  const iconKey = useIconFilterStore((s) => s.iconKey)
  const navigate = useNavigate()

  const iconInfo = useMemo(() => findIcon(iconKey), [iconKey])

  const { data, isLoading } = useSearch(debouncedQuery, iconKey)

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

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const goToDataroom = (id: string, folderId?: string) => {
    close()
    void navigate({
      to: '/datarooms/$dataroomId',
      params: { dataroomId: id },
      search: { folderId },
    })
  }

  const empty =
    !isLoading &&
    (!data || (data.datarooms.length === 0 && data.folders.length === 0 && data.files.length === 0))

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden h-9 items-center gap-2 rounded-lg px-3 text-muted-foreground md:inline-flex md:min-w-52"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left text-sm">
          {iconInfo ? `Search (${iconInfo.label})` : 'Search datarooms, files…'}
        </span>
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
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={
              iconInfo
                ? `Search inside ${iconInfo.label}-tagged datarooms…`
                : 'Search datarooms, folders, files…'
            }
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {empty ? <CommandEmpty>No matches.</CommandEmpty> : null}

            {data && data.datarooms.length > 0 ? (
              <CommandGroup heading="Datarooms">
                {data.datarooms.map((dr) => (
                  <CommandItem
                    key={`dr-${dr.id}`}
                    value={`dr-${dr.id}`}
                    onSelect={() => goToDataroom(dr.id)}
                    className="cursor-pointer gap-2"
                  >
                    <DataroomOrb id={dr.id} iconKey={dr.iconKey} size={16} />
                    <span className="truncate">{dr.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {data && data.folders.length > 0 ? (
              <>
                {data.datarooms.length > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading="Folders">
                  {data.folders.map((f) => (
                    <CommandItem
                      key={`fo-${f.id}`}
                      value={`fo-${f.id}`}
                      onSelect={() => goToDataroom(f.dataroomId, f.id)}
                      className="cursor-pointer gap-2"
                    >
                      <FolderIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{f.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {f.dataroomName}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}

            {data && data.files.length > 0 ? (
              <>
                {data.datarooms.length + data.folders.length > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading="Files">
                  {data.files.map((f) => (
                    <CommandItem
                      key={`fi-${f.id}`}
                      value={`fi-${f.id}`}
                      onSelect={() => goToDataroom(f.dataroomId, f.folderId)}
                      className="cursor-pointer gap-2"
                    >
                      <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <span className="truncate">{f.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {f.dataroomName} / {f.folderName}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
