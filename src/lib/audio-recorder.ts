/**
 * 音频录制器类 - 基于 MediaRecorder API
 * 可在多个页面复用的录音解决方案
 */
import { toast } from 'sonner'

export interface AudioRecorderOptions {
  /** 采样率，默认 16000 */
  sampleRate?: number;
  /** 音频格式，默认 'audio/ogg;codecs=opus' */
  mimeType?: string;
  /** 录音时长限制（毫秒），默认无限制 */
  maxDuration?: number;
}

export interface AudioRecorderResult {
  /** 录音的音频数据 */
  audioBlob: Blob
  /** 录音的音频数据（Base64编码） */
  audioBase64?: string
  /** 录音时长（毫秒） */
  duration: number
  /** 是否达到最大时长限制 */
  reachedMaxDuration: boolean
  /** 是否被取消 */
  cancelled?: boolean
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private startTime: number = 0;
  private options: Required<AudioRecorderOptions>;
  private onResult: ((result: AudioRecorderResult) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  private maxDurationTimer: NodeJS.Timeout | null = null;

  constructor(options: AudioRecorderOptions = {}) {
    this.options = {
      sampleRate: 16000,
      mimeType: options.mimeType || 'audio/ogg;codecs=opus',
      maxDuration: options.maxDuration || 60000
    };
  }

  /**
   * 开始录音
   */
  async startRecording(
    onResult: (result: AudioRecorderResult) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      this.onResult = onResult;
      this.onError = onError;
      this.audioChunks = [];
      this.startTime = 0;

      // 获取音频流
      console.log(`[AudioRecorder] 请求用户媒体权限，音频配置:`, {
        sampleRate: this.options.sampleRate,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log(`[AudioRecorder] 音频流获取成功，轨道数: ${this.stream.getAudioTracks().length}`);
      
      // 检查音频轨道状态
      const audioTracks = this.stream.getAudioTracks();
      audioTracks.forEach((track, index) => {
        console.log(`[AudioRecorder] 音频轨道 ${index}: 启用=${track.enabled}, 状态=${track.readyState}, 标签=${track.label}`);
      });

      // 检查浏览器支持的音频格式
      let mimeType = this.options.mimeType;
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        // 尝试其他格式
        const fallbackTypes = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
          'audio/ogg',
          'audio/mp4',
          'audio/wav',
        ];
        
        mimeType = fallbackTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
        
        if (!mimeType) {
          throw new Error('浏览器不支持音频录制');
        }
      }

      // 创建 MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
      });

      // 设置事件监听器
      this.mediaRecorder.ondataavailable = (event) => {
        console.log(`[AudioRecorder] 收到音频数据块: ${event.data.size} bytes, 类型: ${event.data.type}`);
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`[AudioRecorder] 音频数据块已添加，当前总块数: ${this.audioChunks.length}`);
        } else {
          console.warn(`[AudioRecorder] 收到空的音频数据块`);
        }
      };

      this.mediaRecorder.onstop = () => {
        const autoStopped = (this.mediaRecorder as any)?._autoStopped || false;
        console.log(`[AudioRecorder] MediaRecorder已停止，自动停止: ${autoStopped}, 收集到的音频块数: ${this.audioChunks.length}`);
        this.processRecording(autoStopped);
      };

      this.mediaRecorder.onerror = (event) => {
        this.handleError(new Error(`录音错误: ${event.error}`));
      };

      // 开始录音
      this.startTime = Date.now();
      console.log(`[AudioRecorder] 开始录音，使用格式: ${mimeType}, 采样率: ${this.options.sampleRate}`);
      this.mediaRecorder.start(100); // 每100ms收集一次数据
      console.log(`[AudioRecorder] MediaRecorder已启动，状态: ${this.mediaRecorder.state}`);



      // 设置最大录音时长
      if (this.options.maxDuration > 0) {
        this.maxDurationTimer = setTimeout(() => {
          this.stopRecording();
        }, this.options.maxDuration);
      }

    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 停止录音
   */
  stopRecording(autoStopped: boolean = false): void {
    console.log(`[AudioRecorder] 尝试停止录音，autoStopped: ${autoStopped}`);
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      // 临时存储autoStopped状态
      (this.mediaRecorder as any)._autoStopped = autoStopped
      
      console.log(`[AudioRecorder] 停止录音前状态 - 音频块数: ${this.audioChunks.length}, 录音时长: ${Date.now() - this.startTime}ms`);
      this.mediaRecorder.stop()
      console.log(`[AudioRecorder] 录音已停止, MediaRecorder状态: ${this.mediaRecorder.state}`)
    } else {
      console.warn(`[AudioRecorder] 无法停止录音，MediaRecorder状态: ${this.mediaRecorder?.state || '未初始化'}`);
    }
  }

  /**
   * 取消录音
   */
  cancelRecording(): void {
    this.cleanup();
    if (this.onResult) {
      this.onResult({
        audioBlob: new Blob([], { type: this.options.mimeType }),
        duration: 0,
        reachedMaxDuration: false,
        cancelled: true
      });
    }
  }

  /**
   * 检查是否正在录音
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * 获取支持的音频格式
   */
  static getSupportedMimeTypes(): string[] {
    const types = [
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav',
    ];
    
    return types.filter(type => MediaRecorder.isTypeSupported(type));
  }

  /**
   * 处理录音数据
   */
  private async processRecording(autoStopped: boolean = false): Promise<void> {
    try {
      const duration = this.startTime > 0 ? Date.now() - this.startTime : 0;
      console.log(`[AudioRecorder] 开始处理录音数据，时长: ${duration}ms, 音频块数: ${this.audioChunks.length}`);
      
      if (this.audioChunks.length === 0) {
        console.warn('[AudioRecorder] 录音完成但没有音频数据，跳过语音识别');
        console.log(`[AudioRecorder] 调试信息 - startTime: ${this.startTime}, mediaRecorder状态: ${this.mediaRecorder?.state}`);
        
        // 返回空结果而不是抛出错误
        const result: AudioRecorderResult = {
          audioBlob: new Blob([], { type: this.options.mimeType }),
          duration,
          reachedMaxDuration: false,
          cancelled: false
        };
        
        if (this.onResult) {
          this.onResult(result);
        }
        return;
      }

      // 合并音频数据
      const audioBlob = new Blob(this.audioChunks, { type: this.options.mimeType });
      console.log(`[AudioRecorder] 音频数据合并完成，总大小: ${audioBlob.size} bytes, 类型: ${audioBlob.type}`);

      // 转换为Base64
      let audioBase64: string | undefined;
      if (audioBlob.size > 0) {
        try {
          audioBase64 = await this.blobToBase64(audioBlob);
          console.log(`[AudioRecorder] 音频数据转换为Base64完成，长度: ${audioBase64.length}`);
        } catch (error) {
          console.error(`[AudioRecorder] 转换音频数据为Base64失败:`, error);
        }
      }

      const result: AudioRecorderResult = {
        audioBlob,
        audioBase64,
        duration,
        reachedMaxDuration: this.maxDurationTimer === null && !autoStopped
      }

      console.log(`[AudioRecorder] 录音处理完成，结果:`, {
        audioBlobSize: result.audioBlob.size,
        hasAudioBase64: !!result.audioBase64,
        audioBase64Length: result.audioBase64?.length || 0,
        duration: result.duration,
        reachedMaxDuration: result.reachedMaxDuration
      });

      if (this.onResult) {
        this.onResult(result);
      }
    } catch (error) {
      this.handleError(error as Error);
    } finally {
      // 确保清理资源
      this.cleanup();
    }
  }

  /**
   * 将 Blob 转换为 Base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // 移除 data:audio/xxx;base64, 前缀
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('转换音频数据失败'));
      reader.readAsDataURL(blob);
    });
  }





  /**
   * 清理资源
   */
  private cleanup(): void {
    console.log(`[AudioRecorder] 开始清理资源`);
    
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer)
      this.maxDurationTimer = null
      console.log(`[AudioRecorder] 最大时长定时器已清理`);
    }



    if (this.stream) {
      const trackCount = this.stream.getTracks().length;
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
      console.log(`[AudioRecorder] 音频流已停止，清理了${trackCount}个轨道`);
    }

    if (this.mediaRecorder) {
      this.mediaRecorder = null
      console.log(`[AudioRecorder] MediaRecorder已清理`);
    }


    
    // 清理音频数据
    const audioChunksCount = this.audioChunks.length;
    this.audioChunks = []
    console.log(`[AudioRecorder] 音频数据已清理，清理了${audioChunksCount}个音频块`);
    
    console.log(`[AudioRecorder] 资源清理完成`);
  }

  /**
   * 错误处理
   */
  private handleError(error: Error): void {
    this.cleanup();
    if (this.onError) {
      this.onError(error);
    }
  }

  /**
   * 销毁录音器
   */
  destroy(): void {
    this.cleanup();
    this.onResult = null;
    this.onError = null;
  }
}