import { useLogStore, LogLevel } from '@/stores/logStore'

export class Logger {
  private static instance: Logger
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private log(level: LogLevel, message: string, type: 'serial' | 'software', source?: string) {
    const store = useLogStore.getState()
    store.addLog({
      level,
      message,
      type,
      source,
    })
  }

  // 串口日志方法
  serialInfo(message: string, source?: string) {
    this.log('info', message, 'serial', source)
  }

  serialWarn(message: string, source?: string) {
    this.log('warn', message, 'serial', source)
  }

  serialError(message: string, source?: string) {
    this.log('error', message, 'serial', source)
  }

  serialDebug(message: string, source?: string) {
    this.log('debug', message, 'serial', source)
  }

  // 软件日志方法
  softwareInfo(message: string, source?: string) {
    this.log('info', message, 'software', source)
  }

  softwareWarn(message: string, source?: string) {
    this.log('warn', message, 'software', source)
  }

  softwareError(message: string, source?: string) {
    this.log('error', message, 'software', source)
  }

  softwareDebug(message: string, source?: string) {
    this.log('debug', message, 'software', source)
  }

  // 通用方法
  info(message: string, type: 'serial' | 'software' = 'software', source?: string) {
    this.log('info', message, type, source)
  }

  warn(message: string, type: 'serial' | 'software' = 'software', source?: string) {
    this.log('warn', message, type, source)
  }

  error(message: string, type: 'serial' | 'software' = 'software', source?: string) {
    this.log('error', message, type, source)
  }

  debug(message: string, type: 'serial' | 'software' = 'software', source?: string) {
    this.log('debug', message, type, source)
  }
}

// 导出单例实例
export const logger = Logger.getInstance()

// 导出快捷方法
export const logSerial = {
  info: (message: string, source?: string) => logger.serialInfo(message, source),
  warn: (message: string, source?: string) => logger.serialWarn(message, source),
  error: (message: string, source?: string) => logger.serialError(message, source),
  debug: (message: string, source?: string) => logger.serialDebug(message, source),
}

export const logSoftware = {
  info: (message: string, source?: string) => logger.softwareInfo(message, source),
  warn: (message: string, source?: string) => logger.softwareWarn(message, source),
  error: (message: string, source?: string) => logger.softwareError(message, source),
  debug: (message: string, source?: string) => logger.softwareDebug(message, source),
} 