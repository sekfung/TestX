import {
  createRootRouteWithContext,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

import { Toaster } from '@/components/ui/sonner'
import { LogConsole } from '@/components/log-console'
import { LogTrigger } from '@/components/log-trigger'
import { NavigationProgress } from '@/components/navigation-progress'

function GeneralError() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">出错了</h1>
      <p className="text-muted-foreground">页面加载时发生错误</p>
    </div>
  )
}

function NotFoundError() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">页面未找到</p>
    </div>
  )
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: () => {
    return (
      <>
        <NavigationProgress />
        <Outlet />
        <Toaster duration={3000} closeButton />
        <LogConsole />
        <LogTrigger />
        {import.meta.env.MODE === 'development' && (
          <>
            <ReactQueryDevtools />
            <TanStackRouterDevtools />
          </>
        )}
      </>
    )
  },
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
