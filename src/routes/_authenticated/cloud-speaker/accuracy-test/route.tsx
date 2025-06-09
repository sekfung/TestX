import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

export const Route = createFileRoute('/_authenticated/cloud-speaker/accuracy-test')({  
  component: AccuracyTestLayout,
})

function AccuracyTestLayout() {
  return (
    <>
      <Header>

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