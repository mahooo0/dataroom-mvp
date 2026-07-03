import { RouterProvider } from '@tanstack/react-router'
import { Providers } from '@/app/providers'
import { router } from '@/app/router'
import { SplashProvider } from '@/widgets/splash/SplashProvider'

export function App() {
  return (
    <Providers>
      <SplashProvider>
        <RouterProvider router={router} />
      </SplashProvider>
    </Providers>
  )
}
