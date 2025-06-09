import { Outlet } from '@tanstack/react-router'
import {
  IconMicrophone,
  IconPackages,
  IconFileText,
  IconDatabase,
  IconVariable,
} from '@tabler/icons-react'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import SidebarNav from './components/sidebar-nav'

export default function Settings() {
  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main fixed>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            应用设置
          </h1>
          <p className='text-muted-foreground'>
            管理应用配置、语音识别、IoT平台连接和数据设置。
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 lg:sticky lg:w-1/5'>
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className='flex w-full overflow-y-hidden p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}

const sidebarNavItems = [
  {
    title: '变量管理',
    icon: <IconVariable size={18} />,
    href: '/settings/variables',
  },
  {
    title: '语音识别',
    icon: <IconMicrophone size={18} />,
    href: '/settings/speech',
  },
  {
    title: 'IoT 平台',
    icon: <IconPackages size={18} />,
    href: '/settings/iot',
  },
  {
    title: '数据管理',
    icon: <IconDatabase size={18} />,
    href: '/settings/data',
  },
  {
    title: '日志设置',
    icon: <IconFileText size={18} />,
    href: '/settings/logs',
  },
]
