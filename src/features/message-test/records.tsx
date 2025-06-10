import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { IconRefresh, IconPlus } from '@tabler/icons-react'
import { toast } from 'sonner'
import { createColumns } from './components/columns'
import { DataTable } from './components/data-table'
import { getMessageTests, type MessageTest } from './data/message-tests'
import { useNavigate } from '@tanstack/react-router'

type TestMode = 'form' | 'code'

interface EditingTest {
  id: string
  mode: TestMode
  data: {
    topic: string
    qosLevel: '0' | '1' | '2'
    payload: string
    productKey: string
    deviceName: string
    pythonCode?: string
  }
}

export default function MessageTestRecords() {
  const navigate = useNavigate()
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<MessageTest[]>([])
  const [editingTest, setEditingTest] = useState<EditingTest | null>(null)

  // 加载数据
  const loadData = async () => {
    try {
      setRefreshing(true)
      const tests = await getMessageTests()
      setData(tests)
    } catch (error) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setRefreshing(false)
    }
  }

  // 组件挂载时加载数据
  useEffect(() => {
    loadData()
  }, [])

  // 处理编辑操作 - 跳转到新建页面并传递编辑数据
  const handleEdit = (test: EditingTest) => {
    // 这里可以通过路由状态传递编辑数据，或者使用全局状态管理
    // 暂时先跳转到新建页面
    navigate({ to: '/message-test/new' })
    toast.info('编辑功能将在新建页面中实现')
  }

  // 创建带有回调的columns
  const columnsWithCallback = createColumns(loadData, handleEdit, () => {}, () => {})

  return (
    <div className="space-y-6">
      <div className='flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>测试记录</h2>
          <p className='text-muted-foreground'>
            查看和管理所有报文测试记录，支持重新发送、编辑和删除操作。
          </p>
        </div>
        <div className='flex space-x-2'>
          <Button 
            variant='outline' 
            onClick={loadData}
            disabled={refreshing}
          >
            <IconRefresh className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button onClick={() => navigate({ to: '/message-test/new' })}>
            <IconPlus className='mr-2 h-4 w-4' />
            新建测试
          </Button>
        </div>
      </div>

      <div className='-mx-4 flex-1 overflow-auto px-4 py-1 lg:flex-row lg:space-y-0 lg:space-x-12'>
        <DataTable 
          data={data} 
          columns={columnsWithCallback} 
          tableName="message-test" 
          onDataChange={loadData}
        />
      </div>
    </div>
  )
}