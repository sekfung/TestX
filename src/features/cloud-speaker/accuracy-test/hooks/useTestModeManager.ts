import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { 
  createAccuracyTest, 
  executeAccuracyTestPythonCode, 
  sendIoTMessageWithPrecomputedParams,
  createTimedRecordingTask
} from '@/lib/tauri-api'
import type { AccuracyTest } from '@/lib/tauri-api'
import { logger } from '@/utils/logger'

export interface IoTParams {
  topic: string
  qos_level: number
  payload: string
  product_key: string
  device_name: string
  mode: string
}

export interface TestModeState {
  testMode: 'manual' | 'loop' | 'timed'
  loopCount: number
  scheduledTime: string
  currentLoop: number
  isAutoTesting: boolean
  lastIoTParams: IoTParams | null
  lastExpectedText: string
  loopInterval: number // 循环间隔时间（秒）
  recordingTimeout: number // 录音超时时间（秒）
}

export interface TestModeActions {
  setTestMode: (mode: 'manual' | 'loop' | 'timed') => void
  setLoopCount: (count: number) => void
  setScheduledTime: (time: string) => void
  setCurrentLoop: (loop: number) => void
  setIsAutoTesting: (testing: boolean) => void
  setLastIoTParams: (params: IoTParams | null) => void
  setLastExpectedText: (text: string) => void
  setLoopInterval: (interval: number) => void
  setRecordingTimeout: (timeout: number) => void
  executePythonCode: (pythonCode: string) => Promise<{ iotParams: IoTParams; expectedText: string }>
  createTestForMode: (pythonCode: string, notes: string) => Promise<AccuracyTest>
  startLoopTest: (pythonCode: string, notes: string, onTestCreated: (test: AccuracyTest, iotParams: IoTParams, expectedText: string) => Promise<void>) => Promise<void>
  startTimedTest: (pythonCode: string, notes: string, onTestCreated: (test: AccuracyTest, iotParams: IoTParams, expectedText: string) => Promise<void>) => Promise<void>
  stopAutoTesting: () => void
}

export function useTestModeManager(): TestModeState & TestModeActions {
  const [testMode, setTestMode] = useState<'manual' | 'loop' | 'timed'>('manual')
  const [loopCount, setLoopCount] = useState(1)
  const [scheduledTime, setScheduledTime] = useState('')
  const [currentLoop, setCurrentLoop] = useState(0)
  const [isAutoTesting, setIsAutoTesting] = useState(false)
  const [lastIoTParams, setLastIoTParams] = useState<IoTParams | null>(null)
  const [lastExpectedText, setLastExpectedText] = useState('')
  const [loopInterval, setLoopInterval] = useState(3) // 默认3秒间隔
  const [recordingTimeout, setRecordingTimeout] = useState(15) // 默认15秒超时

  // 用于控制循环测试的引用
  const shouldContinueLoopRef = useRef(true)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const isAutoTestingRef = useRef(false)
  
  // 同步isAutoTesting状态到ref
  useEffect(() => {
    isAutoTestingRef.current = isAutoTesting
  }, [isAutoTesting])

  // 执行Python代码获取IoT参数和期望文本
  const executePythonCode = useCallback(async (pythonCode: string) => {
    if (!pythonCode.trim()) {
      throw new Error('Python代码不能为空')
    }

    try {
      const result = await executeAccuracyTestPythonCode(pythonCode)
      
      if (!result.success || !result.result) {
        throw new Error(result.error || 'Python代码执行失败')
      }
      
      const iotParams: IoTParams = {
        topic: result.result.topic,
        qos_level: result.result.qos_level,
        payload: result.result.payload,
        product_key: result.result.product_key,
        device_name: result.result.device_name,
        mode: 'code' // 代码模式
      }
      
      const expectedText = result.expected_text || ''
      
      // 更新状态
      setLastIoTParams(iotParams)
      setLastExpectedText(expectedText)
      
      return { iotParams, expectedText }
    } catch (error) {
      console.error('执行Python代码失败:', error)
      throw new Error(error instanceof Error ? error.message : '执行Python代码失败')
    }
  }, [])

  // 为当前模式创建测试
  const createTestForMode = useCallback(async (
    pythonCode: string, 
    notes: string, 
    expectedText?: string, 
    iotParams?: IoTParams
  ): Promise<AccuracyTest> => {
    const finalExpectedText = expectedText || lastExpectedText
    const finalIoTParams = iotParams || lastIoTParams
    
    if (!finalExpectedText || !finalIoTParams) {
      throw new Error('请先执行Python代码获取期望文本和IoT参数')
    }

    const baseRequest = {
      expected_text: finalExpectedText,
      mode: 'code' as const,
      python_code: pythonCode,
      notes: notes.trim() || undefined,
    }

    let request
    switch (testMode) {
      case 'manual':
        request = {
          ...baseRequest,
          test_mode: 'manual' as const,
        }
        break
      case 'loop':
        request = {
          ...baseRequest,
          notes: notes.trim() ? `${notes.trim()} (循环 ${currentLoop}/${loopCount})` : `循环测试 ${currentLoop}/${loopCount}`,
          test_mode: 'loop' as const,
        }
        break
      case 'timed':
        request = {
          ...baseRequest,
          notes: notes.trim() ? `${notes.trim()} (定时录音)` : '定时录音测试',
          test_mode: 'timed' as const,
          scheduled_time: scheduledTime,
        }
        break
      default:
        throw new Error('未知的测试模式')
    }

    return await createAccuracyTest(request)
  }, [testMode, lastExpectedText, lastIoTParams, currentLoop, loopCount, scheduledTime])

  // 开始循环测试
  const startLoopTest = useCallback(async (
    pythonCode: string, 
    notes: string, 
    onTestCreated: (test: AccuracyTest, iotParams: IoTParams, expectedText: string) => Promise<void>
  ) => {
    if (loopCount < 1) {
      throw new Error('循环次数必须大于0')
    }

    setIsAutoTesting(true)
    setCurrentLoop(0)
    shouldContinueLoopRef.current = true
    
    try {
      for (let i = 0; i < loopCount; i++) {
        logger.softwareDebug(`🔄 [Manager] 循环 ${i + 1}/${loopCount} 开始`, 'useTestModeManager')
        
        // 检查是否应该继续循环
        if (!shouldContinueLoopRef.current) {
          logger.softwareDebug('⏹️ [Manager] 循环被停止，退出循环', 'useTestModeManager')
          break
        }

        setCurrentLoop(i + 1)
        logger.softwareDebug(`📊 [Manager] 设置当前循环为 ${i + 1}`, 'useTestModeManager')
        
        // 每次循环都重新执行Python代码，确保参数不重复
        logger.softwareDebug(`🐍 [Manager] 循环 ${i + 1}/${loopCount} 执行Python代码`, 'useTestModeManager')
        const { iotParams, expectedText } = await executePythonCode(pythonCode)
        logger.softwareDebug(`✅ [Manager] 循环 ${i + 1}/${loopCount} Python代码执行成功`, 'useTestModeManager')
        
        logger.softwareDebug(`🚀 [Manager] 创建循环测试 ${i + 1}/${loopCount}`, 'useTestModeManager')
        
        const newTest = await createTestForMode(pythonCode, notes, expectedText, iotParams)
        logger.softwareDebug(`✅ [Manager] 循环测试 ${i + 1}/${loopCount} 创建成功`, 'useTestModeManager')
        
        logger.softwareDebug(`🎯 [Manager] 开始执行测试回调函数`, 'useTestModeManager')
        // 执行测试（录音和识别）
        await onTestCreated(newTest, iotParams, expectedText)
        logger.softwareDebug(`✅ [Manager] 测试回调函数执行完成`, 'useTestModeManager')
        
        // 如果不是最后一次循环，等待配置的间隔时间再开始下一次
        if (i < loopCount - 1 && shouldContinueLoopRef.current) {
          logger.softwareDebug(`⏱️ [Manager] 等待${loopInterval}秒后开始下一次循环`, 'useTestModeManager')
          await new Promise(resolve => setTimeout(resolve, loopInterval * 1000))
          logger.softwareDebug(`⏱️ [Manager] 等待完成，准备下一次循环`, 'useTestModeManager')
        } else {
          logger.softwareDebug(`🏁 [Manager] 这是最后一次循环或循环被停止`, 'useTestModeManager')
        }
      }
      
      if (shouldContinueLoopRef.current) {
        toast.success(`循环测试完成`, {
          description: `已完成 ${loopCount} 次测试`
        })
      } else {
        toast.info('循环测试已停止')
      }
      
    } catch (error) {
      console.error('❌ 循环测试失败:', error)
      throw error
    } finally {
      setIsAutoTesting(false)
      setCurrentLoop(0)
      shouldContinueLoopRef.current = true
    }
  }, [loopCount, executePythonCode, createTestForMode])

  // 开始定时测试
  const startTimedTest = useCallback(async (
    pythonCode: string, 
    notes: string, 
    onTestCreated: (test: AccuracyTest, iotParams: IoTParams, expectedText: string) => Promise<void>
  ) => {
    if (!scheduledTime) {
      throw new Error('请选择录音时间')
    }
    
    const scheduledDateTime = new Date(scheduledTime)
    const now = new Date()
    
    if (scheduledDateTime <= now) {
      throw new Error('录音时间必须是未来时间')
    }

    // 执行Python代码获取期望文本和IoT参数
    const { iotParams, expectedText } = await executePythonCode(pythonCode)

    setIsAutoTesting(true)
    
    try {
      console.log('🚀 创建定时录音测试')
      
      const newTest = await createTestForMode(pythonCode, notes, expectedText, iotParams)
      console.log('✅ 定时录音测试创建成功:', newTest)
      
      // 使用新的定时录音API：先发送IoT消息，然后在指定时间通知前端录音
      if (iotParams) {
        await createTimedRecordingTask({
          testId: newTest.id,
          scheduledTime: scheduledDateTime.toISOString(),
          iotTopic: iotParams.topic,
          iotQosLevel: iotParams.qos_level,
          iotPayload: iotParams.payload,
          iotProductKey: iotParams.product_key,
          iotDeviceName: iotParams.device_name,
          expectedText: expectedText,
          pythonCode: pythonCode
        })
        
        const delay = scheduledDateTime.getTime() - now.getTime()
        const minutes = Math.floor(delay / 60000)
        const seconds = Math.floor((delay % 60000) / 1000)
        toast.success(`IoT消息已发送，将在${minutes}分${seconds}秒后开始录音`)
        
        // 设置前端回调，等待后端通知录音
        timerRef.current = setTimeout(() => {
          if (isAutoTestingRef.current) {
            onTestCreated(newTest, iotParams, expectedText)
          }
        }, delay + 1000) // 稍微延迟一点，确保后端先发送通知
      }
      
    } catch (error) {
      console.error('❌ 定时录音测试失败:', error)
      setIsAutoTesting(false)
      throw error
    }
  }, [scheduledTime, executePythonCode, createTestForMode, lastIoTParams, isAutoTesting])

  // 停止自动测试
  const stopAutoTesting = useCallback(() => {
    shouldContinueLoopRef.current = false
    
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    
    setIsAutoTesting(false)
    setCurrentLoop(0)
    
    toast.info('自动测试已停止')
  }, [])

  return {
    // State
    testMode,
    loopCount,
    scheduledTime,
    currentLoop,
    isAutoTesting,
    lastIoTParams,
    lastExpectedText,
    loopInterval,
    recordingTimeout,
    
    // Actions
    setTestMode,
    setLoopCount,
    setScheduledTime,
    setCurrentLoop,
    setIsAutoTesting,
    setLastIoTParams,
    setLastExpectedText,
    setLoopInterval,
    setRecordingTimeout,
    executePythonCode,
    createTestForMode,
    startLoopTest,
    startTimedTest,
    stopAutoTesting,
  }
}