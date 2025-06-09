import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { TopNav } from '@/components/layout/top-nav'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { logger } from '@/utils/logger'
import { useLogStore } from '@/stores/logStore'
import { Activity, Mic, Network, Settings } from 'lucide-react'
import ContentSection from '@/features/settings/components/content-section'
import { invoke } from '@tauri-apps/api/core'
import { useNavigate } from '@tanstack/react-router'
import type { ConfigStatus } from '@/types/config'

export default function Dashboard() {
  const { logs } = useLogStore()
  const navigate = useNavigate()
  const [configStatus, setConfigStatus] = useState<ConfigStatus>({
    speech_configured: false,
    iot_configured: false
  })
  
  // 获取最近的日志
  const recentLogs = logs.slice(0, 5)

  // 检查配置状态
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const status = await invoke<ConfigStatus>('check_config_status')
        setConfigStatus(status)
      } catch (error) {
        console.error('检查配置状态失败:', error)
      }
    }
    
    checkConfig()
  }, [])

  // 处理语音识别卡片点击
  const handleSpeechClick = () => {
    navigate({ to: '/settings/speech' })
  }

  // 处理IoT连接卡片点击
  const handleIoTClick = () => {
    navigate({ to: '/settings/iot' })
  }

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <TopNav links={topNav} />
        <div className='ml-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
        </div>
      </Header>

      {/* ===== Main ===== */}
      <Main>
        <Tabs
          orientation='vertical'
          defaultValue='overview'
          className='space-y-4'
        >
          <TabsContent value='overview' className='space-y-4'>
            <ContentSection
              title="欢迎使用 TestX"
              desc=""
            >
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      总日志条数
                    </CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{logs.length}</div>
                    <p className="text-xs text-muted-foreground">
                      包含软件运行和串口通信日志
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    !configStatus.speech_configured ? 'border-orange-200 bg-orange-50/50' : 'border-green-200 bg-green-50/50'
                  }`}
                  onClick={handleSpeechClick}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      语音识别
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Mic className="h-4 w-4 text-muted-foreground" />
                      {!configStatus.speech_configured && (
                        <Settings className="h-3 w-3 text-orange-500" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      configStatus.speech_configured ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {configStatus.speech_configured ? '已配置' : '待配置'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {configStatus.speech_configured 
                        ? '点击查看或修改语音识别配置' 
                        : '请点击前往设置页面配置语音识别服务'
                      }
                    </p>
                  </CardContent>
                </Card>

                <Card 
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                    !configStatus.iot_configured ? 'border-orange-200 bg-orange-50/50' : 'border-green-200 bg-green-50/50'
                  }`}
                  onClick={handleIoTClick}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      IoT 连接
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      {!configStatus.iot_configured && (
                        <Settings className="h-3 w-3 text-orange-500" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${
                      configStatus.iot_configured ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {configStatus.iot_configured ? '已配置' : '待配置'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {configStatus.iot_configured 
                        ? '点击查看或修改IoT连接配置' 
                        : '请点击前往设置页面配置IoT连接'
                      }
                    </p>
                  </CardContent>
                </Card>
              </div>
            </ContentSection>
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}

const topNav = [
  {
    title: 'Overview',
    href: 'dashboard/overview',
    isActive: true,
    disabled: false,
  },
]
