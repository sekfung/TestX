import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogEntry {
  id: string
  timestamp: Date
  level: LogLevel
  type: 'serial' | 'software'
  message: string
  source?: string
}

export interface LogSettings {
  logLevel: LogLevel
  saveSerialLogs: boolean
  saveSoftwareLogs: boolean
  logFileLocation: string
  maxLogEntries: number
}

interface LogState {
  settings: LogSettings
  logs: LogEntry[]
  isConsoleOpen: boolean
  updateSettings: (settings: Partial<LogSettings>) => void
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void
  addBatchLogs: (logs: Array<Omit<LogEntry, 'id' | 'timestamp'>>) => void
  clearLogs: () => void
  toggleConsole: () => void
  setConsoleOpen: (open: boolean) => void
  exportLogs: (filters?: {
    levels?: Set<LogLevel>
    types?: Set<'serial' | 'software'>
    sources?: Set<string>
    searchQuery?: string
  }) => Promise<void>
}

// 获取默认的日志保存路径
const getDefaultLogPath = () => {
  if (typeof window === 'undefined') return '/Users/Documents/logs'
  
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()
  
  if (userAgent.includes('mac') || platform.includes('mac')) {
    return '/Users/your-username/Documents/logs'
  } else if (userAgent.includes('win') || platform.includes('win')) {
    return 'C:\\Users\\your-username\\Documents\\logs'
  } else {
    return '/home/your-username/Documents/logs'
  }
}

const defaultSettings: LogSettings = {
  logLevel: 'info',
  saveSerialLogs: true,
  saveSoftwareLogs: true,
  logFileLocation: getDefaultLogPath(),
  maxLogEntries: 1000,
}

// 全局序列计数器，确保日志顺序
let logSequence = 0

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      logs: [],
      isConsoleOpen: false,
      
      updateSettings: (newSettings) =>
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        })),
      
      addLog: (logData) =>
        set((state) => {
          const { settings, logs } = state
          
          // 检查日志级别过滤
          const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 }
          if (levelPriority[logData.level] < levelPriority[settings.logLevel]) {
            return state
          }
          
          // 检查日志类型过滤
          if (
            (logData.type === 'serial' && !settings.saveSerialLogs) ||
            (logData.type === 'software' && !settings.saveSoftwareLogs)
          ) {
            return state
          }
          
          // 使用序列计数器和高精度时间戳确保日志顺序
          const sequence = ++logSequence
          const now = performance.now()
          const timestamp = new Date()
          
          const newLog: LogEntry = {
            ...logData,
            id: `${Date.now()}-${sequence.toString().padStart(6, '0')}-${now.toFixed(3)}`,
            timestamp,
          }
          
          // 添加到末尾，保持时间顺序（最新的在最后）
          const newLogs = [...logs, newLog].slice(-settings.maxLogEntries)
          
          return { logs: newLogs }
        }),
      
      addBatchLogs: (batchLogData) =>
        set((state) => {
          const { settings, logs } = state
          const levelPriority = { debug: 0, info: 1, warn: 2, error: 3 }
          
          // 批量处理日志，过滤并转换
          const validLogs: LogEntry[] = []
          const baseTime = Date.now()
          const basePerf = performance.now()
          
          batchLogData.forEach((logData, index) => {
            // 检查日志级别过滤
            if (levelPriority[logData.level] < levelPriority[settings.logLevel]) {
              return
            }
            
            // 检查日志类型过滤
            if (
              (logData.type === 'serial' && !settings.saveSerialLogs) ||
              (logData.type === 'software' && !settings.saveSoftwareLogs)
            ) {
              return
            }
            
            // 使用序列计数器和高精度时间戳确保日志顺序
            const sequence = ++logSequence
            const timestamp = new Date(baseTime + index) // 确保批量日志的时间顺序
            
            const newLog: LogEntry = {
              ...logData,
              id: `${baseTime}-${sequence.toString().padStart(6, '0')}-${(basePerf + index).toFixed(3)}`,
              timestamp,
            }
            
            validLogs.push(newLog)
          })
          
          if (validLogs.length === 0) {
            return state
          }
          
          // 批量添加到末尾，保持时间顺序（最新的在最后）
          const newLogs = [...logs, ...validLogs].slice(-settings.maxLogEntries)
          
          return { logs: newLogs }
        }),
      
      clearLogs: () => set({ logs: [] }),
      
      toggleConsole: () =>
        set((state) => ({ isConsoleOpen: !state.isConsoleOpen })),
      
      setConsoleOpen: (open) => set({ isConsoleOpen: open }),
      
      exportLogs: async (filters?: {
        levels?: Set<LogLevel>
        types?: Set<'serial' | 'software'>
        sources?: Set<string>
        searchQuery?: string
      }) => {
        const { logs, settings } = get()
        
        console.log('开始导出日志，当前日志数量:', logs.length)
        console.log('筛选条件:', filters)
        
        // 应用筛选条件
        let filteredLogs = logs
        
        if (filters) {
          filteredLogs = logs.filter((log) => {
            // 搜索查询筛选
            const matchesSearch = !filters.searchQuery || 
              log.message.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
              log.source?.toLowerCase().includes(filters.searchQuery.toLowerCase())
            
            // 级别筛选
            const matchesLevel = !filters.levels || filters.levels.has(log.level)
            
            // 类型筛选
            const matchesType = !filters.types || filters.types.has(log.type)
            
            // 模块筛选
            const matchesSource = !filters.sources || !log.source || filters.sources.has(log.source)
            
            return matchesSearch && matchesLevel && matchesType && matchesSource
          })
        }
        
        console.log('筛选后的日志数量:', filteredLogs.length)
        
        if (filteredLogs.length === 0) {
          console.warn('没有符合筛选条件的日志可导出')
          toast.warning('没有符合筛选条件的日志可导出')
          return
        }

        try {
          // 生成筛选信息
          const filterInfo = filters ? [
            filters.levels ? `级别: ${Array.from(filters.levels).join(', ')}` : null,
            filters.types ? `类型: ${Array.from(filters.types).join(', ')}` : null,
            filters.sources ? `模块: ${Array.from(filters.sources).join(', ')}` : null,
            filters.searchQuery ? `搜索: "${filters.searchQuery}"` : null
          ].filter(Boolean).join(' | ') : '无筛选'

          // 生成日志内容，包含源信息
          const logText = filteredLogs
            .slice() // 创建副本避免修改原数组
            .reverse() // 按时间顺序排列（最早的在前）
            .map((log) => {
              const timeStr = log.timestamp.toISOString().replace('T', ' ').replace('Z', '')
              const sourceStr = log.source ? ` [${log.source}]` : ''
              return `[${timeStr}] [${log.level.toUpperCase()}] [${log.type}]${sourceStr} ${log.message}`
            })
            .join('\n')

          // 添加文件头信息
          const header = `# 日志导出文件\n# 导出时间: ${new Date().toISOString()}\n# 总日志条数: ${logs.length}\n# 导出日志条数: ${filteredLogs.length}\n# 筛选条件: ${filterInfo}\n# 设置的保存路径: ${settings.logFileLocation}\n# 格式: [时间] [级别] [类型] [来源] 消息\n\n`
          const fullContent = header + logText

          const now = new Date()
          const dateStr = now.toISOString().split('T')[0]
          const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '')
          const fileName = `logs_${dateStr}_${timeStr}${filters ? '_filtered' : ''}.txt`

          console.log('准备导出文件:', fileName)
          console.log('文件内容长度:', fullContent.length)

          // 检查是否在Tauri环境中
          console.log('=== Tauri环境检测开始 ===')
          console.log('window.__TAURI__ 存在:', !!window.__TAURI__)
          console.log('window.__TAURI__.fs 存在:', !!(window.__TAURI__?.fs))

          if (window.__TAURI__?.fs) {
            console.log('✅ 检测到Tauri环境，使用Tauri文件API')
            await handleTauriSave()
          } else {
            console.log('⚠️ 非Tauri环境，使用Web下载')
            handleWebDownload()
          }

          async function handleTauriSave() {
            try {
              // 检查Tauri环境
              console.log('=== 详细Tauri环境检测 ===')
              console.log('window.__TAURI__ 存在:', !!window.__TAURI__)
              console.log('window.__TAURI__ 内容:', window.__TAURI__)
              console.log('window.ipc 存在:', !!(window as any).ipc)
              console.log('window.__TAURI_IPC__ 存在:', !!(window as any).__TAURI_IPC__)
              
              // Tauri v2 检测：使用 window.ipc
              if (!(window as any).ipc) {
                throw new Error('Tauri API not available')
              }
              
              console.log('Tauri环境检测成功，准备导入API...')
              
              // 使用Tauri的core API调用我们的Rust后端
              const { invoke } = await import('@tauri-apps/api/core')
              
              console.log('Tauri core API导入成功，invoke函数类型:', typeof invoke)
              
              // 确保用户设置的路径是绝对路径
              let userPath = settings.logFileLocation
              
              // 检查是否为绝对路径
              const isAbsolutePath = userPath.startsWith('/') || userPath.match(/^[A-Za-z]:[\\/]/) || userPath.startsWith('~')
              
              if (!isAbsolutePath) {
                // 如果不是绝对路径，添加用户主目录前缀
                userPath = `~/${userPath}`
                console.log('转换相对路径为绝对路径:', userPath)
              }
              
              // 使用处理后的绝对路径作为主要保存位置
              const savePath = `${userPath}/${fileName}`
              
              console.log('=== 准备调用save_text_file ===')
              console.log('命令名称: save_text_file')
              console.log('原始用户路径:', settings.logFileLocation)
              console.log('处理后的路径:', userPath)
              console.log('完整保存路径:', savePath)
              console.log('内容长度:', fullContent.length)
              console.log('内容预览:', fullContent.substring(0, 100) + '...')
              
              // 先测试一个简单的命令确保Tauri通信正常
              console.log('=== 测试greet命令 ===')
              const greetResult = await invoke('greet', { name: 'FileTest' })
              console.log('greet命令结果:', greetResult)
              
              console.log('=== 开始调用save_text_file命令 ===')
              // 调用我们自定义的Rust后端保存文件
              const result = await invoke('save_text_file', {
                path: savePath,
                content: fullContent
              })
              
              console.log('save_text_file调用成功，返回值:', result)
              
              toast.success(`日志已保存: ${fileName}`, {
                description: `文件已保存到: ${savePath}${!isAbsolutePath ? ' (已转换为绝对路径)' : ''}`
              })
              console.log(`成功导出 ${filteredLogs.length} 条日志到: ${savePath}`)
              
            } catch (tauriError: any) {
              console.error('=== Tauri保存失败详细信息 ===')
              console.error('错误类型:', typeof tauriError)
              console.error('错误对象:', tauriError)
              console.error('错误消息:', tauriError.message)
              console.error('错误代码:', tauriError.code)
              console.error('错误栈:', tauriError.stack)
              
              if (tauriError.message) {
                console.error('具体错误信息:', tauriError.message)
              }
              
              // 尝试使用Downloads目录作为备用方案
              try {
                console.log('=== 尝试备用保存方案（Downloads目录）===')
                
                const { invoke } = await import('@tauri-apps/api/core')
                // 备用方案：保存到Downloads目录
                const backupPath = `~/Downloads/${fileName}`
                
                console.log('尝试保存到Downloads目录:', backupPath)
                const backupResult = await invoke('save_text_file', {
                  path: backupPath,
                  content: fullContent
                })
                
                console.log('备用方案调用结果:', backupResult)
                
                toast.success(`日志已保存: ${fileName}`, {
                  description: `文件已保存到备用位置: ${backupPath}`
                })
                console.log('备用保存方案成功')
                
              } catch (backupError: any) {
                console.error('=== 备用方案也失败 ===')
                console.error('备用错误:', backupError)
                console.error('备用错误消息:', backupError.message)
                
                toast.error('Tauri文件保存失败: ' + (tauriError.message || '未知错误'))
                
                // 最后降级到Web方式
                console.log('=== 降级到Web下载方式 ===')
                handleWebDownload()
              }
            }
          }

          function handleWebDownload() {
            try {
              console.log('开始Web下载...')
              
              // 创建和下载文件
              const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' })
              console.log('Blob created, size:', blob.size)
              
              const url = URL.createObjectURL(blob)
              console.log('URL created:', url)
              
              const a = document.createElement('a')
              a.href = url
              a.download = fileName
              a.style.display = 'none'
              
              // 确保元素添加到DOM中
              document.body.appendChild(a)
              console.log('Link added to DOM, triggering click...')
              a.click()
              
              // 延迟清理，确保下载开始
              setTimeout(() => {
                try {
                  document.body.removeChild(a)
                  URL.revokeObjectURL(url)
                  console.log('清理完成')
                } catch (cleanupError) {
                  console.warn('清理资源时出错:', cleanupError)
                }
              }, 1000)

              toast.success(`日志已导出: ${fileName}`, {
                description: `⬇️ 文件已下载到浏览器默认下载目录\n📁 您可以手动移动到: ${settings.logFileLocation}`,
                duration: 10000
              })

              console.log(`成功导出 ${filteredLogs.length} 条日志`)
            } catch (downloadError) {
              console.error('Web下载失败:', downloadError)
              throw downloadError
            }
          }

        } catch (error: any) {
          console.error('导出日志失败:', error)
          toast.error('导出日志失败: ' + (error.message || '未知错误'))
        }
      },
    }),
    {
      name: 'log-settings',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
)

// 监听Rust后端日志的函数
export const initRustLogListener = () => {
  console.log('=== 初始化Rust日志监听器 ===')
  console.log('当前时间:', new Date().toISOString())
  
  // 检查是否在Tauri环境中
  const isTauriEnv = !!(window as any).ipc
  console.log('Tauri环境检测:', isTauriEnv)
  
  if (!isTauriEnv) {
    console.log('非Tauri环境，跳过Rust日志监听')
    return
  }

  console.log('✅ Tauri环境检测成功，准备设置事件监听器...')

  // 清理已存在的监听器
  if ((window as any).__rustLogUnlisten) {
    console.log('⚠️ 发现已存在的监听器，先清理...')
    try {
      ;(window as any).__rustLogUnlisten()
      ;(window as any).__rustLogUnlisten = null
      console.log('✅ 已清理旧监听器')
    } catch (cleanupError) {
      console.error('清理旧监听器失败:', cleanupError)
    }
  }

  // 直接设置监听器
  setupEventListener()

  // 同时延迟重试一次，确保万无一失
  setTimeout(() => {
    if (!(window as any).__rustLogUnlisten) {
      console.log('🔄 监听器未设置成功，重试中...')
      setupEventListener()
    }
  }, 2000)
}

// 分离的监听器设置函数
async function setupEventListener() {
  try {
    console.log('开始导入Tauri事件API...')
    const eventModule = await import('@tauri-apps/api/event')
    console.log('✅ Tauri事件模块导入成功')
    
    console.log('设置rust-log事件监听器...')
    
    // 监听rust-log事件（后端日志）
    const unlistenRustLog = await eventModule.listen('rust-log', (event) => {
      console.log('🎉 收到Rust日志事件！')
      console.log('事件详情:', {
        event: event.event,
        id: event.id,
        payload: event.payload,
        timestamp: new Date().toISOString()
      })
      
      try {
        const logData = event.payload as any
        
        // 验证日志数据格式
        if (!logData.level || !logData.message) {
          console.error('❌ 无效的日志数据格式:', logData)
          return
        }
        
        console.log('✅ 处理日志数据:', logData)
        
        // 添加到日志store
        const { addLog } = useLogStore.getState()
        addLog({
          level: logData.level,
          type: logData.type || 'software',
          message: logData.message,
          source: logData.source || 'Rust'
        })
        
        console.log('✅ 日志已添加到store，当前总数:', useLogStore.getState().logs.length)
        
      } catch (parseError) {
        console.error('❌ 处理日志数据时出错:', parseError)
      }
    })
    
    console.log('✅ rust-log事件监听器设置成功！')
    
    // 监听rust-log-batch事件（批量后端日志，用于性能优化）
    const unlistenRustLogBatch = await eventModule.listen('rust-log-batch', (event) => {
      console.log('🎉 收到Rust批量日志事件！')
      console.log('批量事件详情:', {
        event: event.event,
        id: event.id,
        payloadLength: Array.isArray(event.payload) ? event.payload.length : 0,
        timestamp: new Date().toISOString()
      })
      
      try {
        const batchLogs = event.payload as any[]
        
        if (!Array.isArray(batchLogs)) {
          console.error('❌ 无效的批量日志数据格式:', batchLogs)
          return
        }
        
        console.log(`✅ 处理批量日志数据，共 ${batchLogs.length} 条`)
        
        // 批量添加到日志store（优化性能）
        const store = useLogStore.getState()
        
        // 验证并转换批量日志数据
        const validLogs = batchLogs
          .map((logData, index) => {
            // 验证每条日志数据格式
            if (!logData.level || !logData.message) {
              console.error(`❌ 第${index + 1}条日志数据格式无效:`, logData)
              return null
            }
            
            return {
              level: logData.level,
              type: logData.type || 'software',
              message: logData.message,
              source: logData.source || 'Rust'
            }
          })
          .filter(log => log !== null)
        
        // 批量添加日志（减少状态更新次数）
        if (validLogs.length > 0) {
          store.addBatchLogs(validLogs)
        }
        
        console.log(`✅ 批量日志已添加到store，当前总数: ${useLogStore.getState().logs.length}`)
        
      } catch (parseError) {
        console.error('❌ 处理批量日志数据时出错:', parseError)
      }
    })
    
    console.log('✅ rust-log-batch事件监听器设置成功！')
    
    // 存储unlisten函数
    ;(window as any).__rustLogUnlisten = unlistenRustLog
    ;(window as any).__rustLogBatchUnlisten = unlistenRustLogBatch
    console.log('✅ unlisten函数已存储')
    
    // 发送一个测试消息以验证监听器工作
    console.log('监听器设置完成，等待Rust端事件...')
    
  } catch (error) {
    console.error('❌ 设置rust-log事件监听器失败:', error)
  }
}