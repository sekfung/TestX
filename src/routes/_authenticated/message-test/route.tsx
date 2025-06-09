import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

export const Route = createFileRoute('/_authenticated/message-test')({  
  component: MessageTestLayout,
})

function MessageTestLayout() {
  return (
    <>
      <Header>
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">报文测试</h1>
        </div>
        <div className="flex items-center gap-4">
          <Search />
          <ThemeSwitch />
        </div>
      </Header>
      <Main>
        <Outlet />
      </Main>
    </>
  )
}