import { UserButton, useUser } from '@clerk/react'
import { Link } from '@tanstack/react-router'
import { FolderLock } from 'lucide-react'
import { ThemeToggle } from '@/widgets/header/ThemeToggle'

export function AppHeader() {
  const { isSignedIn } = useUser()

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link to="/datarooms" className="flex items-center gap-2 font-semibold">
          <FolderLock className="h-5 w-5" aria-hidden />
          <span>Dataroom</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isSignedIn ? (
            <UserButton
              appearance={{ elements: { avatarBox: 'h-8 w-8' } }}
            />
          ) : null}
        </div>
      </div>
    </header>
  )
}
