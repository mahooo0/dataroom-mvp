import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
} from '@tanstack/react-router'
import { RootLayout } from '@/app/RootLayout'
import { RequireAuth } from '@/app/RequireAuth'
import { DataroomsListPage } from '@/pages/datarooms-list/DataroomsListPage'
import { SignInPage } from '@/pages/sign-in/SignInPage'
import { SignUpPage } from '@/pages/sign-up/SignUpPage'

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

const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  component: () => (
    <RequireAuth>
      <Outlet />
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
