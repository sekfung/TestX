import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { DateTimePicker } from '@/components/ui/datetime-picker'
import { AccuracyPythonEditor } from './components/accuracy-python-editor'
import { 
  IconMicrophone, 
  IconCode,
  IconRepeat,
  IconClock,
  IconPlayerPlay
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
import type { AccuracyTest } from '@/lib/tauri-api'
import { useTestModeManager, type IoTParams } from './hooks/useTestModeManager'
import { useRecordingManager } from './hooks/useRecordingManager'
import { logger } from '@/utils/logger'

export default function AccuracyTestNew() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [currentTest, setCurrentTest] = useState<AccuracyTest | null>(null)
  const [pythonCode, setPythonCode] = useState('')
  const [notes, setNotes] = useState('')
  
  // 使用测试模式管理器
  const testModeManager = useTestModeManager()
  
  // 使用录音管理器
  const recordingManager = useRecordingManager(navigate)

  // Python代码执行成功回调
  const handlePythonExecuteSuccess = (result: any) => {
    console.log('Python代码执行成功:', result)
    
    // 保存IoT参数和期望文本，避免重复执行
    if (result.result) {
      testModeManager.setLastIoTParams({
        topic: result.result.topic,
        qos_level: result.result.qos_level,
        payload: result.result.payload,
        product_key: result.result.product_key,
        device_name: result.result.device_name,
        mode: result.result.mode
      })
      // 修复：expected_text在result的顶层，不在result.result中
      testModeManager.setLastExpectedText(result.expected_text || '')
      
      toast.success('Python代码执行成功', {
        description: `期望播报: ${result.expected_text || '未知'}`
      })
    }
  }

  // Python代码执行失败回调
  const handlePythonExecuteError = (error: string) => {
    console.error('Python代码执行失败:', error)
    toast.error('Python代码执行失败', {
      description: error
    })
  }

  // 创建测试
  const createTest = async () => {
    if (testModeManager.testMode === 'manual') {
      // 手动模式需要先检查是否已执行Python代码
      if (!testModeManager.lastExpectedText) {
        toast.error('请先执行Python代码获取期望文本')
        return
      }
      await startManualTest()
    } else if (testModeManager.testMode === 'loop') {
      // 循环模式自动执行Python代码
      await startLoopTest()
    } else if (testModeManager.testMode === 'timed') {
      // 定时模式自动执行Python代码
      await startTimedTest()
    }
  }

  // 手动测试模式：创建测试后等待用户手动开始录音
  const startManualTest = async () => {
    setLoading(true)
    try {
      const test = await testModeManager.createTestForMode(pythonCode, notes)
      setCurrentTest(test)
      toast.success('测试创建成功，可以开始录音')
    } catch (error) {
      console.error('创建测试失败:', error)
      toast.error('创建测试失败', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    } finally {
      setLoading(false)
    }
  }

  // 循环测试模式
  const startLoopTest = async () => {
    logger.softwareDebug('🚀 [UI] 开始循环测试', 'AccuracyTestNew')
    setLoading(true)
    try {
      await testModeManager.startLoopTest(
        pythonCode,
        notes,
        async (test: AccuracyTest, iotParams: IoTParams, expectedText: string) => {
          logger.softwareDebug(`🔄 [UI] 开始执行测试 ${test.id}，当前循环: ${testModeManager.currentLoop}/${testModeManager.loopCount}`, 'AccuracyTestNew')
          
          // 在每次测试开始前重置loading状态，让用户看到进度更新
          setLoading(false)
          logger.softwareDebug('📱 [UI] 重置loading状态为false', 'AccuracyTestNew')
          
          // 给UI一个短暂时间来更新显示
          await new Promise(resolve => setTimeout(resolve, 100))
          logger.softwareDebug('⏱️ [UI] UI更新延迟完成', 'AccuracyTestNew')
          
          logger.softwareDebug('🎤 [UI] 开始录音和测试', 'AccuracyTestNew')
          await recordingManager.startRecordingAndTest(
            test,
            iotParams,
            expectedText,
            pythonCode
          )
          
          logger.softwareDebug('⏳ [UI] 等待测试完成', 'AccuracyTestNew')
          await recordingManager.waitForTestCompletion()
          logger.softwareDebug('✅ [UI] 测试完成，准备下一次循环', 'AccuracyTestNew')
          
          // 测试完成后再次给UI时间更新
          await new Promise(resolve => setTimeout(resolve, 100))
          logger.softwareDebug('🔄 [UI] 测试完成后延迟结束', 'AccuracyTestNew')
        }
      )
      logger.softwareDebug('🎉 [UI] 所有循环测试完成', 'AccuracyTestNew')
    } catch (error) {
      logger.softwareError(`❌ [UI] 循环测试失败: ${error}`, 'AccuracyTestNew')
      toast.error('循环测试失败', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    } finally {
      logger.softwareDebug('🏁 [UI] 循环测试结束，重置loading状态', 'AccuracyTestNew')
      setLoading(false)
    }
  }

  // 定时测试模式
  const startTimedTest = async () => {
    setLoading(true)
    try {
      await testModeManager.startTimedTest(
        pythonCode,
        notes,
        async (test: AccuracyTest, iotParams: IoTParams, expectedText: string) => {
          await recordingManager.startRecordingAndTest(
            test,
            iotParams,
            expectedText,
            pythonCode
          )
        }
      )
    } catch (error) {
      console.error('定时测试失败:', error)
      toast.error('定时测试失败', {
        description: error instanceof Error ? error.message : '未知错误'
      })
    } finally {
      setLoading(false)
    }
  }

  // 开始录音（手动模式）
  const startRecording = async () => {
    if (!currentTest || !testModeManager.lastIoTParams || !testModeManager.lastExpectedText) {
      toast.error('请先创建测试')
      return
    }

    await recordingManager.startRecordingAndTest(
      currentTest,
      testModeManager.lastIoTParams,
      testModeManager.lastExpectedText,
      pythonCode
    )
  }

  // 停止录音
  const stopRecording = async () => {
    await recordingManager.stopRecording()
    
    // 如果是自动测试模式，停止整个测试
    if (testModeManager.isAutoTesting) {
      testModeManager.stopAutoTesting()
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className='text-2xl font-bold tracking-tight'>新建准确性测试</h2>
        <p className='text-muted-foreground'>
          使用语音识别技术测试云音箱的播报准确性，支持手动模式、循环次数模式和定时录音模式。手动模式需要手动执行代码和录音，循环和定时模式会自动执行代码和发送IoT消息。
        </p>
      </div>

      {/* 新建测试区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <IconCode className="h-5 w-5" />
            <span>创建新测试</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <AccuracyPythonEditor
              initialCode={pythonCode}
              onCodeChange={setPythonCode}
              onExecuteSuccess={handlePythonExecuteSuccess}
              onExecuteError={handlePythonExecuteError}
            />

            {/* 测试模式选择 */}
            <div className="space-y-4">
              <Label className="text-base font-medium">测试模式</Label>
              <RadioGroup value={testModeManager.testMode} onValueChange={(value) => testModeManager.setTestMode(value as 'manual' | 'loop' | 'timed')} className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                  <RadioGroupItem value="manual" id="manual" />
                  <Label htmlFor="manual" className="flex items-center space-x-2 cursor-pointer">
                    <IconPlayerPlay className="h-4 w-4" />
                    <span>手动模式</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                  <RadioGroupItem value="loop" id="loop" />
                  <Label htmlFor="loop" className="flex items-center space-x-2 cursor-pointer">
                    <IconRepeat className="h-4 w-4" />
                    <span>循环次数模式</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                  <RadioGroupItem value="timed" id="timed" />
                  <Label htmlFor="timed" className="flex items-center space-x-2 cursor-pointer">
                    <IconClock className="h-4 w-4" />
                    <span>定时录音模式</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* 模式配置选项 */}
            {testModeManager.testMode === 'loop' && (
              <div className="space-y-3">
                <Label htmlFor="loopCount">循环次数</Label>
                <div className="flex items-center space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => testModeManager.setLoopCount(Math.max(1, testModeManager.loopCount - 1))}
                    disabled={testModeManager.loopCount <= 1}
                    className="h-9 w-9 p-0"
                  >
                    -
                  </Button>
                  <Input
                    id="loopCount"
                    type="number"
                    min="1"
                    value={testModeManager.loopCount}
                    onChange={(e) => testModeManager.setLoopCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-center w-20"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => testModeManager.setLoopCount(testModeManager.loopCount + 1)}
                    className="h-9 w-9 p-0"
                  >
                    +
                  </Button>
                  <span className="text-sm text-muted-foreground">次</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  将连续进行 {testModeManager.loopCount} 次录音测试
                </p>
              </div>
            )}

            {testModeManager.testMode === 'timed' && (
              <div className="space-y-3">
                <Label htmlFor="scheduledTime">录音时间</Label>
                <DateTimePicker
                   value={testModeManager.scheduledTime ? new Date(testModeManager.scheduledTime) : undefined}
                   onChange={(date) => {
                     if (date) {
                       testModeManager.setScheduledTime(date.toISOString())
                     } else {
                       testModeManager.setScheduledTime('')
                     }
                   }}
                   placeholder="选择录音开始时间"
                   minDate={new Date()} // 最小时间为当前时间
                   className="w-full"
                 />
                <p className="text-sm text-muted-foreground">
                  选择具体的录音开始时间（只能选择未来时间）
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">备注（可选）</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="添加测试备注信息..."
                rows={2}
              />
            </div>

            {/* 当前状态显示 */}
            {testModeManager.isAutoTesting && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <IconRepeat className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">
                    {testModeManager.testMode === 'loop' ? `循环测试进行中：${testModeManager.currentLoop}/${testModeManager.loopCount}` : '定时测试进行中'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
               {testModeManager.testMode === 'manual' ? (
                 // 手动模式：分为创建测试和开始录音两个步骤
                 <>
                   {!currentTest ? (
                     <Button 
                       onClick={createTest}
                       disabled={loading || !pythonCode.trim() || !testModeManager.lastExpectedText}
                       className="flex-1"
                     >
                       <IconMicrophone className="h-4 w-4 mr-2" />
                       创建测试
                     </Button>
                   ) : (
                     <Button 
                       onClick={recordingManager.isRecording ? stopRecording : startRecording}
                       disabled={loading}
                       className="flex-1"
                       variant={recordingManager.isRecording ? "destructive" : "default"}
                     >
                       <IconMicrophone className="h-4 w-4 mr-2" />
                       {recordingManager.isRecording ? '停止录音' : '开始录音'}
                     </Button>
                   )}
                 </>
               ) : (
                 // 自动模式：循环测试和定时测试
                 <Button 
                   onClick={testModeManager.isAutoTesting ? stopRecording : createTest}
                   disabled={loading || (!testModeManager.isAutoTesting && !pythonCode.trim())}
                   className="flex-1"
                   variant={testModeManager.isAutoTesting ? "destructive" : "default"}
                 >
                   <IconMicrophone className="h-4 w-4 mr-2" />
                   {testModeManager.isAutoTesting ? '停止测试' :
                    testModeManager.testMode === 'loop' ? `开始循环测试 (${testModeManager.loopCount}次)` : '开始定时测试'}
                 </Button>
               )}
              
              <Button 
                variant="outline"
                onClick={() => navigate({ to: '/cloud-speaker/accuracy-test/records' })}
                disabled={recordingManager.isRecording || testModeManager.isAutoTesting}
              >
                查看记录
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}