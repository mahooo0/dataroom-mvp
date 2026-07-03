import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from '@tanstack/react-router'
import { RequireAuth } from '@/app/RequireAuth'
import { RootLayout } from '@/app/RootLayout'
import { DataroomsListPage } from '@/pages/datarooms-list/DataroomsListPage'
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

const routeTree = rootRoute.addChildren([
  indexRoute,
  signInRoute,
  signUpRoute,
  ssoCallbackRoute,
  authedRoute.addChildren([datroomsListRoute]),
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
