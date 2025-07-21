import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconForms, IconCode, IconPlayerPlay } from '@tabler/icons-react'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { PythonCodeEditor } from './components/python-code-editor'
import { sendMessage, sendMessageFromPython, sendMessageWithPrecomputedParams } from './data/message-tests'
import { useNavigate } from '@tanstack/react-router'

type TestMode = 'form' | 'code'

export default function MessageTestNew() {
  const navigate = useNavigate()
  const [testMode, setTestMode] = useState<TestMode>('code')
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    topic: '',
    qosLevel: '1' as '0' | '1' | '2',
    payload: '',
    productKey: '',
    deviceName: '',
    enableLoop: false,
    loopCount: 1,
    interval: 1000,
  })
  const [pythonCode, setPythonCode] = useState('')
  const [pythonResult, setPythonResult] = useState<{
    topic: string
    qos_level: number
    payload: string
    product_key: string
    device_name: string
  } | null>(null)
  const [loopStatus, setLoopStatus] = useState<{
    isRunning: boolean
    currentLoop: number
    totalLoops: number
    results: Array<{ success: boolean; message: string; timestamp: string }>
  }>({ isRunning: false, currentLoop: 0, totalLoops: 0, results: [] })
  
  // 使用 ref 来跟踪循环运行状态，避免闭包问题
  const isLoopRunningRef = React.useRef(false)

  // 页面卸载时的清理逻辑
  useEffect(() => {
    return () => {
      // 如果有正在运行的循环测试，不要强制停止，让它在后台继续运行
      // 这样用户可以切换页面查看记录而不会中断测试
      if (isLoopRunningRef.current) {
        console.log('页面切换，循环测试继续在后台运行')
      }
    }
  }, [])

  // 重置表单
  const resetForm = () => {
    setFormData({
      topic: '',
      qosLevel: '1',
      payload: '',
      productKey: '',
      deviceName: '',
      enableLoop: false,
      loopCount: 1,
      interval: 1000,
    })
    setPythonCode('')
    setPythonResult(null)
  }

  // 循环执行核心函数
  const handleLoopExecution = async (data: {
    topic: string
    qosLevel: '0' | '1' | '2'
    payload: string
    productKey: string
    deviceName: string
    loopCount: number
    interval: number
  }, mode: 'form' | 'code') => {
    // 设置循环运行状态
    isLoopRunningRef.current = true
    
    setLoopStatus({
      isRunning: true,
      currentLoop: 0,
      totalLoops: data.loopCount,
      results: []
    })

    const results: Array<{ success: boolean; message: string; timestamp: string }> = []
    
    for (let i = 0; i < data.loopCount; i++) {
      if (!isLoopRunningRef.current) break // 检查是否被停止
      
      setLoopStatus(prev => ({ ...prev, currentLoop: i + 1 }))
      
      try {
        const messageId = await sendMessage(
          data.topic,
          parseInt(data.qosLevel),
          data.payload,
          data.productKey,
          data.deviceName,
          mode
        )
        
        const result = {
          success: true,
          message: `发送成功，消息ID: ${messageId}`,
          timestamp: new Date().toLocaleTimeString()
        }
        
        results.push(result)
        setLoopStatus(prev => ({ ...prev, results: [...prev.results, result] }))
        
      } catch (error) {
        const result = {
          success: false,
          message: error instanceof Error ? error.message : '发送失败',
          timestamp: new Date().toLocaleTimeString()
        }
        
        results.push(result)
        setLoopStatus(prev => ({ ...prev, results: [...prev.results, result] }))
      }
      
      // 如果不是最后一次循环，等待间隔时间
      if (i < data.loopCount - 1) {
        await new Promise(resolve => setTimeout(resolve, data.interval))
      }
    }
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    
    toast.success(`循环测试完成！成功: ${successCount}, 失败: ${failCount}`, {
      description: `总共发送 ${results.length} 条消息`
    })
    
    isLoopRunningRef.current = false
    setLoopStatus(prev => ({ ...prev, isRunning: false }))
  }

  // 停止循环
  const stopLoop = () => {
    isLoopRunningRef.current = false
    setLoopStatus(prev => ({ ...prev, isRunning: false }))
    toast.info('循环测试已停止')
  }

  // 表单提交处理
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setLoading(true)
      
      // 验证必要字段
      if (!formData.productKey.trim()) {
        toast.error('Product Key不能为空')
        return
      }
      
      if (!formData.deviceName.trim()) {
        toast.error('Device Name不能为空')
        return
      }
      
      // 验证JSON格式
      if (formData.payload.trim()) {
        try {
          JSON.parse(formData.payload)
        } catch {
          toast.error('报文内容必须是有效的JSON格式')
          return
        }
      }

      if (formData.enableLoop) {
        // 循环模式
        await handleLoopExecution({
          topic: formData.topic,
          qosLevel: formData.qosLevel,
          payload: formData.payload,
          productKey: formData.productKey,
          deviceName: formData.deviceName,
          loopCount: formData.loopCount,
          interval: formData.interval
        }, 'form')
      } else {
        // 单次发送
        const messageId = await sendMessage(
          formData.topic,
          parseInt(formData.qosLevel),
          formData.payload,
          formData.productKey,
          formData.deviceName,
          'form'
        )
        
        toast.success(`报文发送成功，消息ID: ${messageId}`, {
          description: '可以继续发送更多测试或切换到代码模式'
        })
      }
      
    } catch (error) {
      console.error('发送失败:', error)
      toast.error(error instanceof Error ? error.message : '发送失败')
    } finally {
      setLoading(false)
    }
  }

  // Python代码执行成功回调
  const handlePythonSuccess = (result: { topic: string; qos_level: number; payload: string; product_key: string; device_name: string }) => {
    setPythonResult(result)
    toast.success('Python代码执行成功，参数已生成')
  }

  // Python代码执行失败回调
  const handlePythonError = (error: string) => {
    setPythonResult(null)
    toast.error(error)
  }

  // 通过Python参数发送IoT消息
  const sendIoTMessageFromPython = async (enableLoop = false, loopCount = 1, interval = 1000) => {
    if (!pythonResult) {
      toast.error('请先执行Python代码生成参数')
      return
    }

    try {
      setLoading(true)
      
      if (enableLoop) {
        // 循环模式
        await handleLoopExecution({
          topic: pythonResult.topic,
          qosLevel: pythonResult.qos_level.toString() as '0' | '1' | '2',
          payload: pythonResult.payload,
          productKey: pythonResult.product_key,
          deviceName: pythonResult.device_name,
          loopCount,
          interval
        }, 'code')
      } else {
        // 单次发送
        const messageId = await sendMessage(
          pythonResult.topic,
          pythonResult.qos_level,
          pythonResult.payload,
          pythonResult.product_key,
          pythonResult.device_name,
          'code',
          pythonCode
        )
        
        toast.success(`通过Python参数发送成功，消息ID: ${messageId}`, {
          description: '可以继续修改代码或参数进行更多测试'
        })
      }
      
    } catch (error) {
      console.error('发送失败 - 详细错误:', error)
      toast.error(error instanceof Error ? error.message : '发送失败')
    } finally {
      setLoading(false)
    }
  }

  const renderFormMode = () => (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <IconForms className="h-5 w-5 text-blue-600" />
          <CardTitle>表单模式</CardTitle>
          <Badge variant="outline" className="text-xs">
            传统表单输入
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFormSubmit} className='space-y-4'>
          {/* 第一行：Product Key 和 Device Name */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='productKey'>Product Key <span className="text-red-500">*</span></Label>
              <Input
                id='productKey'
                placeholder='例: a1WvzjC1YpQ'
                value={formData.productKey}
                onChange={(e) => setFormData({ ...formData, productKey: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='deviceName'>Device Name <span className="text-red-500">*</span></Label>
              <Input
                id='deviceName'
                placeholder='例: device_123'
                value={formData.deviceName}
                onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
                required
                disabled={loading}
              />
            </div>
          </div>
          
          {/* 第二行：主题和QoS等级 */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='topic'>主题</Label>
              <Input
                id='topic'
                placeholder='例: /user/service/voiceBroadcast'
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                required
                disabled={loading}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='qosLevel'>QoS等级</Label>
              <Select
                value={formData.qosLevel}
                onValueChange={(value: '0' | '1' | '2') => 
                  setFormData({ ...formData, qosLevel: value })
                }
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='0'>
                    <div className='flex items-center space-x-2'>
                      <Badge className='bg-gray-100 text-gray-800 border-0'>QoS 0</Badge>
                      <span className='text-sm text-muted-foreground'>最多一次</span>
                    </div>
                  </SelectItem>
                  <SelectItem value='1'>
                    <div className='flex items-center space-x-2'>
                      <Badge className='bg-blue-100 text-blue-800 border-0'>QoS 1</Badge>
                      <span className='text-sm text-muted-foreground'>至少一次</span>
                    </div>
                  </SelectItem>
                  <SelectItem value='2'>
                    <div className='flex items-center space-x-2'>
                      <Badge className='bg-green-100 text-green-800 border-0'>QoS 2</Badge>
                      <span className='text-sm text-muted-foreground'>只有一次</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* 第三行：报文内容 */}
          <div className='space-y-2'>
            <Label htmlFor='payload'>报文内容</Label>
            <Textarea
              id='payload'
              placeholder='请输入JSON格式的报文内容，例: {"messageId": 12345, "command": "play", "content": "Hello World"}'
              value={formData.payload}
              onChange={(e) => setFormData({ ...formData, payload: e.target.value })}
              rows={6}
              required
              disabled={loading || loopStatus.isRunning}
            />
          </div>
          
          {/* 第四行：循环设置 */}
          <div className='space-y-4 p-4 border rounded-lg bg-muted/30'>
            <div className='flex items-center justify-between'>
              <div className='space-y-1'>
                <Label htmlFor='enableLoop' className='text-base font-medium'>启用循环测试</Label>
                <p className='text-sm text-muted-foreground'>开启后将按设定次数和间隔重复发送报文</p>
              </div>
              <Switch
                id='enableLoop'
                checked={formData.enableLoop}
                onCheckedChange={(checked) => setFormData({ ...formData, enableLoop: checked })}
                disabled={loading || loopStatus.isRunning}
              />
            </div>
            
            {formData.enableLoop && (
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t'>
                <div className='space-y-2'>
                  <Label htmlFor='loopCount'>循环次数</Label>
                  <Input
                    id='loopCount'
                    type='number'
                    min='1'
                    max='1000'
                    placeholder='请输入循环次数（1-1000）'
                    value={formData.loopCount}
                    onChange={(e) => setFormData({ ...formData, loopCount: parseInt(e.target.value) || 1 })}
                    required
                    disabled={loading || loopStatus.isRunning}
                  />
                </div>
                <div className='space-y-2'>
                  <Label htmlFor='interval'>间隔时间（毫秒）</Label>
                  <Input
                    id='interval'
                    type='number'
                    min='100'
                    max='60000'
                    placeholder='请输入间隔时间（100-60000ms）'
                    value={formData.interval}
                    onChange={(e) => setFormData({ ...formData, interval: parseInt(e.target.value) || 1000 })}
                    required
                    disabled={loading || loopStatus.isRunning}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* 循环状态显示 */}
          {loopStatus.isRunning && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-blue-800 font-medium">循环测试进行中...</span>
                </div>
                <Badge className="bg-blue-100 text-blue-800">
                  {loopStatus.currentLoop} / {loopStatus.totalLoops}
                </Badge>
              </div>
              <div className="text-sm text-blue-700">
                已完成 {loopStatus.currentLoop} 次，剩余 {loopStatus.totalLoops - loopStatus.currentLoop} 次
              </div>
            </div>
          )}
          
          {/* 测试结果 */}
          {loopStatus.results.length > 0 && (
            <div className="space-y-2">
              <Label>测试结果</Label>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                {loopStatus.results.map((result, index) => (
                  <div key={index} className={`p-3 border-b last:border-b-0 ${
                    result.success ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge className={result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          第 {index + 1} 次
                        </Badge>
                        <span className="text-sm">{result.message}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{result.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className='flex justify-between items-center space-x-4'>
            <div className='flex space-x-2'>
              <Button 
                type='button' 
                variant='outline' 
                onClick={() => navigate({ to: '/message-test/records' })}
                disabled={loading}
              >
                查看记录
              </Button>
              <Button 
                type='button' 
                variant='outline' 
                onClick={() => {
                  resetForm()
                  setLoopStatus({ isRunning: false, currentLoop: 0, totalLoops: 0, results: [] })
                  toast.info('表单已清空')
                }}
                disabled={loading || loopStatus.isRunning}
                className="text-orange-600 hover:text-orange-700"
              >
                清空表单
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              {loopStatus.isRunning && (
                <Button 
                  type='button' 
                  variant='outline' 
                  onClick={stopLoop}
                  className="text-red-600 hover:text-red-700"
                >
                  停止循环
                </Button>
              )}
              <Button type='submit' disabled={loading || loopStatus.isRunning}>
                {loopStatus.isRunning ? '循环中...' : formData.enableLoop ? '开始循环测试' : '发送报文'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )

  // 代码模式循环设置组件
  const CodeLoopSettings = () => {
    const [codeLoopEnabled, setCodeLoopEnabled] = useState(false)
    const [codeLoopCount, setCodeLoopCount] = useState(1)
    const [codeLoopInterval, setCodeLoopInterval] = useState(1000)

    return (
      <>
        <div className='space-y-4 p-4 border rounded-lg bg-muted/30'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label htmlFor='codeEnableLoop' className='text-base font-medium'>启用循环测试</Label>
              <p className='text-sm text-muted-foreground'>开启后将按设定次数和间隔重复发送报文</p>
            </div>
            <Switch
              id='codeEnableLoop'
              checked={codeLoopEnabled}
              onCheckedChange={setCodeLoopEnabled}
              disabled={loading || loopStatus.isRunning}
            />
          </div>
          
          {codeLoopEnabled && (
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t'>
              <div className='space-y-2'>
                <Label htmlFor='codeLoopCount'>循环次数</Label>
                <Input
                  id='codeLoopCount'
                  type='number'
                  min='1'
                  max='1000'
                  placeholder='请输入循环次数（1-1000）'
                  value={codeLoopCount}
                  onChange={(e) => setCodeLoopCount(parseInt(e.target.value) || 1)}
                  required
                  disabled={loading || loopStatus.isRunning}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='codeLoopInterval'>间隔时间（毫秒）</Label>
                <Input
                  id='codeLoopInterval'
                  type='number'
                  min='100'
                  max='60000'
                  placeholder='请输入间隔时间（100-60000ms）'
                  value={codeLoopInterval}
                  onChange={(e) => setCodeLoopInterval(parseInt(e.target.value) || 1000)}
                  required
                  disabled={loading || loopStatus.isRunning}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* 循环状态显示 */}
        {loopStatus.isRunning && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-blue-800 font-medium">循环测试进行中...</span>
              </div>
              <Badge className="bg-blue-100 text-blue-800">
                {loopStatus.currentLoop} / {loopStatus.totalLoops}
              </Badge>
            </div>
            <div className="text-sm text-blue-700">
              已完成 {loopStatus.currentLoop} 次，剩余 {loopStatus.totalLoops - loopStatus.currentLoop} 次
            </div>
          </div>
        )}
        
        {/* 测试结果 */}
        {loopStatus.results.length > 0 && (
          <div className="space-y-2">
            <Label>测试结果</Label>
            <div className="max-h-60 overflow-y-auto border rounded-lg">
              {loopStatus.results.map((result, index) => (
                <div key={index} className={`p-3 border-b last:border-b-0 ${
                  result.success ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge className={result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                        第 {index + 1} 次
                      </Badge>
                      <span className="text-sm">{result.message}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{result.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <Button 
            variant="outline" 
            onClick={() => navigate({ to: '/message-test/records' })}
            disabled={loopStatus.isRunning}
          >
            查看测试记录
          </Button>
          
          <div className="flex items-center space-x-2">
            {loopStatus.isRunning && (
              <Button 
                variant='outline' 
                onClick={stopLoop}
                className="text-red-600 hover:text-red-700"
              >
                停止循环
              </Button>
            )}
            <Button 
              onClick={() => sendIoTMessageFromPython(codeLoopEnabled, codeLoopCount, codeLoopInterval)}
              disabled={loading || !pythonResult || loopStatus.isRunning}
              className="bg-green-600 hover:bg-green-700"
            >
              <IconPlayerPlay className="h-4 w-4 mr-2" />
              {loopStatus.isRunning ? '循环中...' : codeLoopEnabled ? '开始循环测试' : '发送IoT消息'}
            </Button>
          </div>
        </div>
      </>
    )
  }

  const renderCodeMode = () => (
    <div className="space-y-4">
      {/* Python代码编辑器 */}
      <PythonCodeEditor 
        initialCode={pythonCode}
        onCodeChange={setPythonCode}
        onExecuteSuccess={handlePythonSuccess}
        onExecuteError={handlePythonError}
      />
       
      {/* 发送按钮区域 */}
      {pythonResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <IconPlayerPlay className="h-5 w-5 text-green-600" />
                <CardTitle className="text-lg">发送IoT消息</CardTitle>
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  参数已就绪
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Python代码已生成以下参数，可选择单次发送或循环测试
              </div>
              <div className="bg-muted p-3 rounded-md font-mono text-sm">
                <div><strong>主题:</strong> {pythonResult.topic}</div>
                <div><strong>QoS:</strong> {pythonResult.qos_level}</div>
                <div><strong>载荷:</strong> {pythonResult.payload.substring(0, 100)}{pythonResult.payload.length > 100 ? '...' : ''}</div>
              </div>
              
              {/* 代码模式循环设置 */}
              <CodeLoopSettings />
            </div>
          </CardContent>
        </Card>
      )}
      
      {!pythonResult && (
        <div className="flex justify-start">
          <Button 
            variant="outline" 
            onClick={() => navigate({ to: '/message-test/records' })}
          >
            查看测试记录
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>新建报文测试</h2>
        <p className='text-muted-foreground'>
          云音箱报文发送测试，支持表单模式和Python代码模式，支持不同QoS等级的MQTT消息发送。
        </p>
      </div>

      <Tabs value={testMode} onValueChange={(value) => setTestMode(value as TestMode)}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="code" className="flex items-center space-x-2">
            <IconCode className="h-4 w-4" />
            <span>代码模式</span>
          </TabsTrigger>
          <TabsTrigger value="form" className="flex items-center space-x-2">
            <IconForms className="h-4 w-4" />
            <span>表单模式</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="code" className="mt-4">
          {renderCodeMode()}
        </TabsContent>

        <TabsContent value="form" className="mt-4">
          {renderFormMode()}
        </TabsContent>
      </Tabs>
    </div>
  )
}