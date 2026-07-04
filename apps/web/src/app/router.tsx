import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from '@tanstack/react-router'
import { RequireAuth } from '@/app/RequireAuth'
import { RootLayout } from '@/app/RootLayout'
import { DataroomDetailPage } from '@/pages/dataroom-detail/DataroomDetailPage'
import { DataroomsListPage } from '@/pages/datarooms-list/DataroomsListPage'
import { PublicSharePage } from '@/pages/public-share/PublicSharePage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { SignInPage } from '@/pages/sign-in/SignInPage'
import { SignUpPage } from '@/pages/sign-up/SignUpPage'
import { SsoCallbackPage } from '@/pages/sso-callback/SsoCallbackPage'
import { AppShell } from '@/widgets/app-shell/AppShell'

const rootRoute = createRootRoute({
  component: () => (
    <RootLayout>
      <Outlet />
    </RootLayout>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Navigate to="/datarooms" replace />,
})

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in/$',
  component: SignInPage,
})

const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-up/$',
  component: SignUpPage,
})

const ssoCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sso-callback',
  component: SsoCallbackPage,
})

const publicShareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/share/$token',
  component: () => {
    const { token } = publicShareRoute.useParams()
    return <PublicSharePage token={token} />
  },
})

const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  component: () => (
    <RequireAuth>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireAuth>
  ),
})

const datroomsListRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/datarooms',
  component: DataroomsListPage,
})

const dataroomDetailRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/datarooms/$dataroomId',
  validateSearch: (search: Record<string, unknown>) => ({
    folderId: typeof search.folderId === 'string' ? search.folderId : undefined,
  }),
  component: () => {
    const { dataroomId } = dataroomDetailRoute.useParams()
    const { folderId } = dataroomDetailRoute.useSearch()
    return <DataroomDetailPage dataroomId={dataroomId} folderId={folderId ?? null} />
  },
})

const settingsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/settings',
  component: SettingsPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  signUpRoute,
  ssoCallbackRoute,
  publicShareRoute,
  authedRoute.addChildren([datroomsListRoute, dataroomDetailRoute, settingsRoute]),
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
