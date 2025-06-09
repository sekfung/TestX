/**
 * 语音录音器模块 - 统一的录音解决方案
 * 支持Web Audio API和MediaRecorder两种录音方式
 * 可在准确性测试页面和设置页面复用
 */
import { toast } from 'sonner'
import { invoke } from '@tauri-apps/api/core'
import { logger } from '@/utils/logger'

export interface SpeechRecorderOptions {
  /** 采样率，默认 16000 */
  sampleRate?: number
  /** 音频格式，默认 'audio/ogg;codecs=opus' */
  mimeType?: string
  /** 录音时长限制（毫秒），默认 60000 */
  maxDuration?: number
  /** 录音方式，默认 'webaudio' */
  recordingMode?: 'webaudio' | 'mediarecorder'
  /** 是否自动识别，默认 true */
  autoRecognize?: boolean
  /** 识别完成后的回调 */
  onRecognitionResult?: (result: string) => void
  /** 识别错误的回调 */
  onRecognitionError?: (error: string) => void
  /** 识别完成后是否立即停止录音，默认 true */
  stopOnRecognition?: boolean
}

export interface SpeechRecorderResult {
  /** 录音的音频数据 */
  audioBlob?: Blob
  /** 录音的音频数据（Base64编码） */
  audioBase64?: string
  /** 录音时长（毫秒） */
  duration: number
  /** 是否达到最大时长限制 */
  reachedMaxDuration: boolean
  /** 是否被取消 */
  cancelled?: boolean
  /** 识别结果 */
  recognitionResult?: string
}

export class SpeechRecorder {
  private options: Required<SpeechRecorderOptions>
  private isRecording = false
  private startTime = 0
  private maxDurationTimer: NodeJS.Timeout | null = null
  private recognitionTimer: NodeJS.Timeout | null = null
  
  // MediaRecorder 相关
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  
  // Web Audio API 相关
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private audioData: Float32Array[] = []
  
  // 回调函数
  private onResult: ((result: SpeechRecorderResult) => void) | null = null
  private onError: ((error: Error) => void) | null = null
  
  // 实时识别相关
  private isRecognizing = false

  constructor(options: SpeechRecorderOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate || 16000,
      mimeType: options.mimeType || 'audio/ogg;codecs=opus',
      maxDuration: options.maxDuration || 60000,
      recordingMode: options.recordingMode || 'webaudio',
      autoRecognize: options.autoRecognize !== false,
      onRecognitionResult: options.onRecognitionResult || (() => {}),
      onRecognitionError: options.onRecognitionError || (() => {}),
      stopOnRecognition: options.stopOnRecognition !== false
    }
  }

  /**
   * 开始录音
   */
  async startRecording(
    onResult: (result: SpeechRecorderResult) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (this.isRecording) {
      throw new Error('录音已在进行中')
    }

    try {
      this.onResult = onResult
      this.onError = onError
      this.isRecording = true
      this.startTime = Date.now()
      
      // 清理之前的数据
      this.audioChunks = []
      this.audioData = []

      // 获取音频流
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      // 根据录音模式选择不同的实现
      if (this.options.recordingMode === 'webaudio') {
        await this.startWebAudioRecording()
      } else {
        await this.startMediaRecorderRecording()
      }

      // 设置最大录音时长
      if (this.options.maxDuration > 0) {
        this.maxDurationTimer = setTimeout(() => {
          this.stopRecording(true)
        }, this.options.maxDuration)
      }

      // 如果启用自动识别和识别完成后停止，启动实时识别
      if (this.options.autoRecognize && this.options.stopOnRecognition) {
        this.startRealtimeRecognition()
      }

      toast.success('开始录音', {
        description: '请开始说话，完成后点击停止录音按钮'
      })

    } catch (error) {
      this.cleanup()
      this.handleError(error as Error)
    }
  }

  /**
   * 停止录音
   */
  async stopRecording(autoStopped: boolean = false): Promise<void> {
    if (!this.isRecording) {
      return
    }

    logger.softwareDebug(`[SpeechRecorder] 停止录音，autoStopped: ${autoStopped}`, 'SpeechRecorder')
    
    // 清理定时器
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer)
      this.maxDurationTimer = null
    }

    this.isRecording = false
    const duration = Date.now() - this.startTime

    try {
      let audioBase64: string | undefined
      let audioBlob: Blob | undefined

      if (this.options.recordingMode === 'webaudio') {
        audioBase64 = await this.processWebAudioData()
      } else {
        const result = await this.processMediaRecorderData()
        audioBlob = result.audioBlob
        audioBase64 = result.audioBase64
      }

      // 构建结果
      const result: SpeechRecorderResult = {
        audioBlob,
        audioBase64,
        duration,
        reachedMaxDuration: autoStopped,
        cancelled: false
      }

      // 如果启用自动识别且有音频数据，进行语音识别
      if (this.options.autoRecognize && audioBase64) {
        try {
          const recognitionResult = await this.performSpeechRecognition(audioBase64)
          result.recognitionResult = recognitionResult
          
          // 立即通知识别结果
          this.options.onRecognitionResult(recognitionResult)
          
          toast.success('语音识别成功', {
            description: `识别到 ${recognitionResult.length} 个字符的文本`
          })
          
          // 如果设置了识别完成后立即停止，则立即调用结果回调
          if (this.options.stopOnRecognition) {
            this.cleanup()
            if (this.onResult) {
              this.onResult(result)
            }
            return
          }
        } catch (recognitionError) {
          console.error('语音识别失败:', recognitionError)
          const errorMessage = recognitionError instanceof Error ? recognitionError.message : '识别失败'
          this.options.onRecognitionError(errorMessage)
          
          toast.error('语音识别失败', {
            description: errorMessage
          })
        }
      }

      // 清理资源
      this.cleanup()

      // 调用结果回调
      if (this.onResult) {
        this.onResult(result)
      }

    } catch (error) {
      this.cleanup()
      this.handleError(error as Error)
    }
  }

  /**
   * 取消录音
   */
  cancelRecording(): void {
    if (!this.isRecording) {
      return
    }

    logger.softwareDebug('[SpeechRecorder] 取消录音', 'SpeechRecorder')
    this.cleanup()

    const result: SpeechRecorderResult = {
      duration: Date.now() - this.startTime,
      reachedMaxDuration: false,
      cancelled: true
    }

    if (this.onResult) {
      this.onResult(result)
    }
  }

  /**
   * 检查是否正在录音
   */
  getIsRecording(): boolean {
    return this.isRecording
  }

  /**
   * 启动 Web Audio API 录音
   */
  private async startWebAudioRecording(): Promise<void> {
    if (!this.mediaStream) {
      throw new Error('媒体流未初始化')
    }

    this.audioContext = new AudioContext({ sampleRate: this.options.sampleRate })
    const source = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return
      
      const inputBuffer = e.inputBuffer
      const inputData = inputBuffer.getChannelData(0)
      // 复制音频数据
      const audioData = new Float32Array(inputData.length)
      audioData.set(inputData)
      this.audioData.push(audioData)
    }

    source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  /**
   * 启动 MediaRecorder 录音
   */
  private async startMediaRecorderRecording(): Promise<void> {
    if (!this.mediaStream) {
      throw new Error('媒体流未初始化')
    }

    // 检查浏览器支持的音频格式
    let mimeType = this.options.mimeType
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      const fallbackTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
        'audio/wav'
      ]
      
      mimeType = fallbackTypes.find(type => MediaRecorder.isTypeSupported(type)) || ''
      
      if (!mimeType) {
        throw new Error('浏览器不支持音频录制')
      }
    }

    this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType })

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = () => {
      // MediaRecorder 停止时的处理在 stopRecording 中进行
    }

    this.mediaRecorder.onerror = (event) => {
      this.handleError(new Error(`录音错误: ${event.error}`))
    }

    this.mediaRecorder.start(100) // 每100ms收集一次数据
  }

  /**
   * 处理 Web Audio API 音频数据
   */
  private async processWebAudioData(): Promise<string> {
    if (this.audioData.length === 0) {
      throw new Error('录音数据为空，请重试')
    }

    // 转换为 WAV 格式
    const wavBuffer = this.convertToWav(this.audioData, this.options.sampleRate)
    
    if (wavBuffer.byteLength === 0) {
      throw new Error('音频转换失败，请重试')
    }

    if (wavBuffer.byteLength > 10 * 1024 * 1024) { // 10MB 限制
      throw new Error('录音文件过大，请缩短录音时间')
    }

    // 将 ArrayBuffer 转换为 base64
    const base64 = btoa(
      new Uint8Array(wavBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )

    logger.softwareDebug(`[SpeechRecorder] Web Audio 数据处理完成，大小: ${wavBuffer.byteLength} bytes`, 'SpeechRecorder')
    return base64
  }

  /**
   * 处理 MediaRecorder 音频数据
   */
  private async processMediaRecorderData(): Promise<{ audioBlob: Blob; audioBase64: string }> {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop()
    }

    if (this.audioChunks.length === 0) {
      throw new Error('录音数据为空，请重试')
    }

    // 合并音频数据
    const audioBlob = new Blob(this.audioChunks, { type: this.options.mimeType })
    
    if (audioBlob.size === 0) {
      throw new Error('音频数据为空，请重试')
    }

    // 转换为Base64
    const audioBase64 = await this.blobToBase64(audioBlob)
    
    logger.softwareDebug(`[SpeechRecorder] MediaRecorder 数据处理完成，大小: ${audioBlob.size} bytes`, 'SpeechRecorder')
    return { audioBlob, audioBase64 }
  }

  /**
   * 执行语音识别
   */
  private async performSpeechRecognition(audioBase64: string): Promise<string> {
    logger.softwareDebug('[SpeechRecorder] 开始语音识别', 'SpeechRecorder')
    
    const result = await invoke<string>('recognize_speech', {
      audioBase64
    })

    if (!result || result.trim().length === 0) {
      throw new Error('语音识别服务返回空结果')
    }

    return result
  }

  /**
   * 将 Float32Array 音频数据转换为 WAV 格式
   */
  private convertToWav(audioData: Float32Array[], sampleRate: number = 16000): ArrayBuffer {
    // 计算总长度
    const totalLength = audioData.reduce((sum, chunk) => sum + chunk.length, 0)
    
    // 合并所有音频数据
    const mergedData = new Float32Array(totalLength)
    let mergeOffset = 0
    for (const chunk of audioData) {
      mergedData.set(chunk, mergeOffset)
      mergeOffset += chunk.length
    }

    // 转换为 16位 PCM
    const pcmData = new Int16Array(mergedData.length)
    for (let i = 0; i < mergedData.length; i++) {
      const s = Math.max(-1, Math.min(1, mergedData[i]))
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }

    // 创建 WAV 头部
    const buffer = new ArrayBuffer(44 + pcmData.length * 2)
    const view = new DataView(buffer)

    // WAV 文件头
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    writeString(0, 'RIFF')
    view.setUint32(4, 36 + pcmData.length * 2, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true) // PCM
    view.setUint16(22, 1, true) // 单声道
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(36, 'data')
    view.setUint32(40, pcmData.length * 2, true)

    // 写入音频数据
    const dataOffset = 44
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(dataOffset + i * 2, pcmData[i], true)
    }

    return buffer
  }

  /**
   * 将 Blob 转换为 Base64
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // 移除 data:audio/xxx;base64, 前缀
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  /**
   * 启动实时语音识别
   */
  private startRealtimeRecognition(): void {
    // 每2秒尝试识别一次当前录制的音频
    this.recognitionTimer = setTimeout(() => {
      this.tryRealtimeRecognition()
    }, 2000)
  }

  /**
   * 尝试实时识别
   */
  private async tryRealtimeRecognition(): Promise<void> {
    if (!this.isRecording || this.isRecognizing) {
      return
    }

    // 检查是否有足够的音频数据（至少1秒）
    const currentDuration = Date.now() - this.startTime
    if (currentDuration < 1000) {
      // 继续等待
      this.recognitionTimer = setTimeout(() => {
        this.tryRealtimeRecognition()
      }, 500)
      return
    }

    this.isRecognizing = true

    try {
      let audioBase64: string

      if (this.options.recordingMode === 'webaudio') {
        if (this.audioData.length === 0) {
          this.isRecognizing = false
          this.scheduleNextRecognition()
          return
        }
        audioBase64 = await this.processWebAudioDataForRecognition()
      } else {
        // MediaRecorder 模式下的实时识别比较复杂，暂时跳过
        this.isRecognizing = false
        this.scheduleNextRecognition()
        return
      }

      // 尝试识别
      const recognitionResult = await this.performSpeechRecognition(audioBase64)
      
      if (recognitionResult && recognitionResult.trim().length > 0) {
        logger.softwareDebug('[SpeechRecorder] 实时识别成功，立即停止录音', 'SpeechRecorder')
        
        // 立即停止录音并返回结果
        const result: SpeechRecorderResult = {
          audioBase64,
          duration: Date.now() - this.startTime,
          reachedMaxDuration: false,
          cancelled: false,
          recognitionResult
        }

        // 通知识别结果
        this.options.onRecognitionResult(recognitionResult)
        
        toast.success('语音识别成功', {
          description: `识别到 ${recognitionResult.length} 个字符的文本`
        })

        // 清理资源并调用结果回调
        this.cleanup()
        if (this.onResult) {
          this.onResult(result)
        }
        return
      }

    } catch (error) {
      logger.softwareDebug('[SpeechRecorder] 实时识别失败，继续录音:', 'SpeechRecorder')
      // 识别失败不影响录音继续
    }

    this.isRecognizing = false
    this.scheduleNextRecognition()
  }

  /**
   * 安排下一次识别
   */
  private scheduleNextRecognition(): void {
    if (this.isRecording) {
      this.recognitionTimer = setTimeout(() => {
        this.tryRealtimeRecognition()
      }, 1000) // 每1秒尝试一次
    }
  }

  /**
   * 为实时识别处理 Web Audio 数据（不清空原数据）
   */
  private async processWebAudioDataForRecognition(): Promise<string> {
    if (this.audioData.length === 0) {
      throw new Error('录音数据为空')
    }

    // 创建当前音频数据的副本进行处理
    const audioDataCopy = this.audioData.map(chunk => new Float32Array(chunk))
    
    // 转换为 WAV 格式
    const wavBuffer = this.convertToWav(audioDataCopy, this.options.sampleRate)
    
    if (wavBuffer.byteLength === 0) {
      throw new Error('音频转换失败')
    }

    // 将 ArrayBuffer 转换为 base64
    const base64 = btoa(
      new Uint8Array(wavBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )

    return base64
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.isRecording = false
    this.isRecognizing = false
    
    // 清理定时器
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer)
      this.maxDurationTimer = null
    }

    if (this.recognitionTimer) {
      clearTimeout(this.recognitionTimer)
      this.recognitionTimer = null
    }

    // 清理 Web Audio API 资源
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    // 清理媒体流
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }

    // 清理 MediaRecorder
    this.mediaRecorder = null
    
    // 清理数据
    this.audioChunks = []
    this.audioData = []
  }

  /**
   * 错误处理
   */
  private handleError(error: Error): void {
    console.error('[SpeechRecorder] 错误:', error)
    this.isRecording = false
    
    if (this.onError) {
      this.onError(error)
    }

    // 显示错误提示
    let errorMessage = '录音失败'
    let errorDescription = ''

    if (error.message.includes('Permission denied') || error.message.includes('NotAllowedError')) {
      errorMessage = '无法访问麦克风'
      errorDescription = '请检查麦克风权限设置，确保允许浏览器访问麦克风'
    } else if (error.message.includes('NotFoundError')) {
      errorMessage = '未找到麦克风设备'
      errorDescription = '请检查麦克风是否正确连接'
    } else if (error.message.includes('NotSupportedError')) {
      errorMessage = '浏览器不支持录音功能'
      errorDescription = '请使用支持录音的现代浏览器'
    } else {
      errorDescription = error.message
    }

    toast.error(errorMessage, {
      description: errorDescription
    })
  }
}

/**
 * 创建语音录音器实例的工厂函数
 */
export function createSpeechRecorder(options?: SpeechRecorderOptions): SpeechRecorder {
  return new SpeechRecorder(options)
}

/**
 * 获取支持的音频格式
 */
export function getSupportedMimeTypes(): string[] {
  const types = [
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/wav'
  ]
  
  return types.filter(type => MediaRecorder.isTypeSupported(type))
}