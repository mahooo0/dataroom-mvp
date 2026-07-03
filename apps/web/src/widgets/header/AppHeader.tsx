import { UserButton, useUser } from '@clerk/react'
import { Link } from '@tanstack/react-router'
import { APP_CONFIG } from '@/shared/config/app-config'
import { BrandMark } from '@/shared/ui/brand-mark'
import { ThemeToggle } from '@/widgets/header/ThemeToggle'

export function AppHeader() {
  const { isSignedIn } = useUser()

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link to="/datarooms" className="flex items-center gap-2 font-semibold">
          <BrandMark className="h-7 w-7" />
          <span>{APP_CONFIG.name}</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isSignedIn ? <UserButton appearance={{ elements: { avatarBox: 'h-8 w-8' } }} /> : null}
        </div>
      </div>
    </header>
  )
}
