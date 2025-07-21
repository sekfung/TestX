import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { SpeechRecorder, createSpeechRecorder } from '@/lib/speech-recorder'
import { executeAccuracyTestWithParamsPrecomputed } from '@/lib/tauri-api'
import type { AccuracyTest } from '@/lib/tauri-api'
import type { IoTParams } from './useTestModeManager'
import { logger } from '@/utils/logger'

export interface RecordingState {
  isRecording: boolean
  currentTestId: string | null
}

export interface RecordingActions {
  startRecordingAndTest: (test: AccuracyTest, iotParams: IoTParams, expectedText: string, pythonCode: string, recordingTimeout?: number) => Promise<void>
  stopRecording: () => Promise<void>
  waitForTestCompletion: () => Promise<void>
}

export function useRecordingManager(navigate: any): RecordingState & RecordingActions {
  const [isRecording, setIsRecording] = useState(false)
  const [currentTestId, setCurrentTestId] = useState<string | null>(null)
  
  // 语音录音器引用
  const speechRecorderRef = useRef<SpeechRecorder | null>(null)
  // 事件监听器清理函数
  const unlistenRef = useRef<(() => void) | null>(null)
  // 测试完成标志
  const testCompletedRef = useRef(false)
  // 当前测试的完成Promise
  const testCompletionPromiseRef = useRef<{
    resolve: () => void
    reject: (error: Error) => void
  } | null>(null)

  // 等待测试完成的辅助函数
  const waitForTestCompletion = useCallback((): Promise<void> => {
    logger.softwareDebug(`⏳ [Recording] waitForTestCompletion 被调用，当前testCompleted状态: ${testCompletedRef.current}`, 'useRecordingManager')
    return new Promise((resolve, reject) => {
      // 如果测试已经完成，立即解决
      if (testCompletedRef.current) {
        logger.softwareDebug('✅ [Recording] 测试已完成，立即解决Promise', 'useRecordingManager')
        testCompletedRef.current = false // 重置标志
        logger.softwareDebug('🔄 [Recording] 重置testCompleted标志为false', 'useRecordingManager')
        resolve()
        return
      }
      
      logger.softwareDebug('⏳ [Recording] 测试未完成，设置Promise等待', 'useRecordingManager')
      // 确保之前的Promise被清理
      if (testCompletionPromiseRef.current) {
        logger.softwareDebug('🧹 [Recording] 清理之前的Promise', 'useRecordingManager')
        testCompletionPromiseRef.current.reject(new Error('新的测试开始，取消之前的等待'))
      }
      // 设置新的Promise引用
      testCompletionPromiseRef.current = { resolve, reject }
      logger.softwareDebug('📝 [Recording] 已设置新的Promise等待', 'useRecordingManager')
    })
  }, [])

  // 开始录音和测试
  const startRecordingAndTest = useCallback(async (
    test: AccuracyTest,
    iotParams: IoTParams,
    expectedText: string,
    pythonCode: string,
    recordingTimeout: number = 60 // 默认60秒超时
  ) => {
    console.log('🚀 startRecordingAndTest 被调用，testId:', test.id)
    
    if (!test.id) {
      console.error('❌ startRecordingAndTest: testId 为空')
      toast.error('测试ID无效')
      return
    }
    
    try {
      // 重置状态
      logger.softwareDebug(`🔄 [Recording] 重置状态，testCompleted: ${testCompletedRef.current} -> false`, 'useRecordingManager')
      testCompletedRef.current = false
      setIsRecording(true)
      setCurrentTestId(test.id)
      logger.softwareDebug(`🎯 [Recording] 设置当前测试ID: ${test.id}`, 'useRecordingManager')
      
      // 清理事件监听器
      if (unlistenRef.current) {
        unlistenRef.current()
        unlistenRef.current = null
      }
      
      // 创建语音录音器实例
      const recorder = createSpeechRecorder({
        recordingMode: 'webaudio',
        autoRecognize: false, // 准确性测试不自动识别，需要手动调用测试
        maxDuration: recordingTimeout * 1000, // 使用配置的录音超时时间（转换为毫秒）
        stopOnRecognition: true, // API识别完成后立即停止录音
        onRecognitionResult: (result: string) => {
          // 这里不会被调用，因为 autoRecognize 为 false
        },
        onRecognitionError: (error: string) => {
          toast.error('测试失败', {
            description: error
          })
        }
      })
      
      speechRecorderRef.current = recorder
      

      
      // 设置事件监听器（仅针对当前测试）
      const unlisten = await listen('accuracy_test_completed', async (event) => {
        const updatedTest = event.payload as AccuracyTest
        console.log('🔔 收到测试完成事件:', { 
          eventTestId: updatedTest.id, 
          currentTestId: test.id, 
          testCompleted: testCompletedRef.current,
          match: updatedTest.id === test.id 
        })
        logger.softwareDebug(`📨 [Recording] 收到测试完成事件，testId: ${updatedTest.id}，当前testId: ${test.id}`, 'useRecordingManager')
        
        if (updatedTest.id === test.id && !testCompletedRef.current) {
            logger.softwareDebug('✅ [Recording] 测试ID匹配，开始处理测试完成', 'useRecordingManager')
            
            // 标记测试完成
            testCompletedRef.current = true
            logger.softwareDebug('🏁 [Recording] 设置testCompleted标志为true', 'useRecordingManager')
            logger.softwareDebug(`🎯 [Recording] 测试 ${test.id} 完成，开始处理结果`, 'useRecordingManager')
          
          // 清理事件监听器（在stopRecording之前）
          logger.softwareDebug('🧹 [Recording] 清理事件监听器', 'useRecordingManager')
          unlisten()
          unlistenRef.current = null
          
          // 停止录音并重置状态
          logger.softwareDebug('🛑 [Recording] 停止录音并重置状态', 'useRecordingManager')
          setIsRecording(false)
          setCurrentTestId(null)
          
          // 清理语音录音器资源
          if (speechRecorderRef.current) {
            logger.softwareDebug('🧹 [Recording] 清理语音录音器资源', 'useRecordingManager')
            try {
              await speechRecorderRef.current.stopRecording(false) // 明确指定不是自动停止
              logger.softwareDebug('✅ [Recording] 录音已成功停止', 'useRecordingManager')
            } catch (error) {
              logger.softwareError(`❌ [Recording] 停止录音失败: ${error}`, 'useRecordingManager')
            }
            speechRecorderRef.current = null
          }
          
          const result = updatedTest.result === 'passed' ? '通过' : '失败'
          const similarity = updatedTest.similarity ? `(相似度: ${(updatedTest.similarity * 100).toFixed(1)}%)` : ''
          
          logger.softwareDebug(`📊 [Recording] 测试结果: ${result}, 相似度: ${similarity}`, 'useRecordingManager')
          toast.success('测试完成', {
            description: `识别结果: ${updatedTest.recognized_text || '无结果'} - ${result} ${similarity}`
          })
          
          // 解决等待Promise
          if (testCompletionPromiseRef.current) {
            logger.softwareDebug('✅ [Recording] 解决waitForTestCompletion Promise', 'useRecordingManager')
            testCompletionPromiseRef.current.resolve()
            testCompletionPromiseRef.current = null
          } else {
            logger.softwareDebug('⚠️ [Recording] 没有等待的Promise需要解决', 'useRecordingManager')
          }
          
          // 延迟重置测试完成标志，确保Promise有时间被处理
          setTimeout(() => {
            logger.softwareDebug('⏰ [Recording] 延迟100ms后重置testCompleted标志', 'useRecordingManager')
            testCompletedRef.current = false
            logger.softwareDebug('🔄 [Recording] 重置测试完成标志为false', 'useRecordingManager')
          }, 100)
        }
      })
      
      unlistenRef.current = unlisten

      toast.success('开始测试', {
        description: '等待后端通知开始录音...'
      })
      

      
      // 定义录音完成后的处理函数
      const startRecordingForTest = async (testId: string, iotParams: IoTParams, expectedText: string) => {
        if (!speechRecorderRef.current) {
          console.error('Speech recorder not initialized');
          return;
        }
        
        await speechRecorderRef.current.startRecording(
          async (result) => {
            // 录音完成回调 - 执行语音识别测试
            console.log('Recording completed, sending to backend for recognition');
            setIsRecording(false);
            
            if (result.audioBase64 && !testCompletedRef.current) {
              try {
                // 执行语音识别测试（后端已经发送了IoT消息）
                await executeAccuracyTestWithParamsPrecomputed(
                  testId,
                  result.audioBase64,
                  iotParams.topic,
                  iotParams.qos_level,
                  iotParams.payload,
                  iotParams.product_key,
                  iotParams.device_name,
                  expectedText,
                  true, // 使用预计算参数
                  pythonCode,
                  result.duration
                );
              } catch (error) {
                console.error('语音识别失败:', error);
                
                // 解析错误信息
                let errorMessage = '未知错误';
                if (error instanceof Error) {
                  errorMessage = error.message;
                  if (errorMessage.includes('audio decode failed') || errorMessage.includes('4007')) {
                    errorMessage = '音频解码失败，请检查录音质量或重新录制';
                  }
                }
                
                toast.error('语音识别失败', {
                  description: errorMessage
                });
                
                // 拒绝等待Promise
                if (testCompletionPromiseRef.current) {
                  testCompletionPromiseRef.current.reject(new Error(errorMessage));
                  testCompletionPromiseRef.current = null;
                }
              }
            }
          },
          (error) => {
            // 录音错误回调
            console.error('Recording failed:', error);
            setIsRecording(false);
            
            toast.error('录音失败', {
              description: error.message
            });
            
            // 拒绝等待Promise
             if (testCompletionPromiseRef.current) {
               testCompletionPromiseRef.current.reject(error instanceof Error ? error : new Error(String(error)));
               testCompletionPromiseRef.current = null;
             }
          }
        );
      };

      // 监听后端发送的开始录音事件
      const startRecordingUnlisten = await listen('start_recording_for_test', async (event) => {
        const testId = event.payload as string
        logger.softwareInfo(`📨 [TimedRecording] 收到定时录音启动事件 - TestID: ${testId}, CurrentID: ${test.id}`, 'useRecordingManager')
        
        if (testId === test.id) {
          logger.softwareInfo(`✅ [TimedRecording] 测试ID匹配，开始执行录音 - TestID: ${testId}`, 'useRecordingManager')
          
          toast.success('定时录音开始', {
            description: '定时时间已到，开始录音测试'
          })
          
          try {
            // 开始录音，录音完成后将音频发送给后端进行识别
            logger.softwareDebug('🎤 [TimedRecording] 调用startRecordingForTest函数', 'useRecordingManager')
            await startRecordingForTest(test.id, iotParams, expectedText)
            
            logger.softwareInfo('✅ [TimedRecording] 录音测试执行完成', 'useRecordingManager')
          } catch (error) {
            logger.softwareError(`❌ [TimedRecording] 录音测试执行失败: ${error instanceof Error ? error.message : String(error)}`, 'useRecordingManager')
            toast.error('录音测试失败', {
              description: error instanceof Error ? error.message : '未知错误'
            })
          }
          
          // 清理开始录音事件监听器
          logger.softwareDebug('🧹 [TimedRecording] 清理录音事件监听器', 'useRecordingManager')
          startRecordingUnlisten()
        } else {
          logger.softwareWarn(`⚠️ [TimedRecording] 测试ID不匹配，忽略事件 - Received: ${testId}, Current: ${test.id}`, 'useRecordingManager')
        }
      })
      
      // 直接调用后端执行测试（后端会先通知前端开始录音，然后发送IoT消息）
      try {
        await executeAccuracyTestWithParamsPrecomputed(
          test.id,
          '', // 空的音频数据，后端会等待前端录音完成后再处理
          iotParams.topic,
          iotParams.qos_level,
          iotParams.payload,
          iotParams.product_key,
          iotParams.device_name,
          expectedText,
          true,
          pythonCode,
          0 // 音频时长为0
        )
      } catch (error) {
        console.error('启动测试失败:', error)
        toast.error('启动测试失败', {
          description: error instanceof Error ? error.message : '未知错误'
        })
        
        // 清理事件监听器
        startRecordingUnlisten()
        
        // 拒绝等待Promise
        if (testCompletionPromiseRef.current) {
          testCompletionPromiseRef.current.reject(error instanceof Error ? error : new Error(String(error)))
          testCompletionPromiseRef.current = null
        }
      }
      
    } catch (error) {
      console.error('开始录音和测试失败:', error)
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      toast.error('开始测试失败', {
        description: errorMessage
      })
      setIsRecording(false)
      
      // 拒绝等待Promise
      if (testCompletionPromiseRef.current) {
        testCompletionPromiseRef.current.reject(new Error(errorMessage))
        testCompletionPromiseRef.current = null
      }
    }
  }, [])

  // 停止录音
  const stopRecording = useCallback(async () => {
    console.log('停止录音被调用，当前状态:', { isRecording })
    
    if (speechRecorderRef.current && isRecording) {
      toast.info('录音已停止', {
        description: '正在处理音频数据并执行测试...'
      })
      
      await speechRecorderRef.current.stopRecording()
      speechRecorderRef.current = null
    }
    
    // 清理事件监听器
    if (unlistenRef.current) {
      unlistenRef.current()
      unlistenRef.current = null
    }
    
    // 重置状态
    setIsRecording(false)
    setCurrentTestId(null)
    testCompletedRef.current = false
    
    // 拒绝等待Promise（如果还在等待）
    if (testCompletionPromiseRef.current) {
      testCompletionPromiseRef.current.reject(new Error('录音被手动停止'))
      testCompletionPromiseRef.current = null
    }
    
    console.log('录音已停止，状态已重置')
  }, [isRecording])

  // 组件卸载时的清理函数
  useEffect(() => {
    return () => {
      console.log('语音测试组件卸载，测试将在后台继续运行')
      
      // 注意：不清理任何资源，包括事件监听器
      // 让测试在后台继续运行，保持事件监听器活跃以接收Rust事件
    }
  }, [])

  return {
    isRecording,
    currentTestId,
    startRecordingAndTest,
    stopRecording,
    waitForTestCompletion
  }
}