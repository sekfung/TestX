import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createColumns } from './components/columns'
import { DataTable } from './components/data-table'
import { 
  IconPlus
} from '@tabler/icons-react'
import { AutoRefreshControl } from '@/components/auto-refresh-control'
import { 
  getAccuracyTests,
  deleteAccuracyTest,
  type AccuracyTest
} from '@/lib/tauri-api'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'

export default function AccuracyTestRecords() {
  const navigate = useNavigate()
  const [tests, setTests] = useState<AccuracyTest[]>([])
  const [loading, setLoading] = useState(false)

  // 加载测试列表
  const loadTests = async () => {
    try {
      setLoading(true)
      const result = await getAccuracyTests()
      setTests(result)
    } catch (error) {
      console.error('加载测试列表失败:', error)
      toast.error('加载测试列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 删除测试
  const deleteTest = async (testId: string) => {
    try {
      await deleteAccuracyTest(testId)
      setTests(prev => prev.filter(test => test.id !== testId))
      toast.success('测试删除成功')
    } catch (error) {
      console.error('删除测试失败:', error)
      toast.error('删除测试失败')
    }
  }

  // 处理编辑操作 - 跳转到新建页面
  const handleEdit = (editData: {
    id: string
    mode: 'code'
    data: {
      pythonCode?: string
      notes?: string
    }
  }) => {
    // 这里可以通过路由状态传递编辑数据，或者使用全局状态管理
    // 暂时先跳转到新建页面
    navigate({ to: '/cloud-speaker/accuracy-test/new' })
    toast.info('编辑功能将在新建页面中实现')
  }

  useEffect(() => {
    loadTests()
  }, [])

  return (
    <div className="space-y-6">
      <div className='flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>测试记录</h2>
          <p className='text-muted-foreground'>
            查看和管理所有准确性测试记录，支持重新测试、编辑和删除操作。
          </p>
        </div>
        <div className='flex space-x-2'>
          <AutoRefreshControl 
            onRefresh={loadTests}
            intervals={[5, 10, 15, 30]}
            defaultInterval={10}
          />
          <Button onClick={() => navigate({ to: '/cloud-speaker/accuracy-test/new' })}>
            <IconPlus className='mr-2 h-4 w-4' />
            新建测试
          </Button>
        </div>
      </div>

      {/* 测试结果列表 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>测试记录</CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                总数: {tests.length}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable 
            data={tests} 
            columns={createColumns(deleteTest, loadTests, handleEdit, () => {})} 
            onDelete={deleteTest}
            onDataChange={loadTests}
            onEdit={handleEdit}
            onShowForm={() => {}}
            onBatchDelete={loadTests}
            tableName="accuracy-test"
          />
        </CardContent>
      </Card>
    </div>
  )
}