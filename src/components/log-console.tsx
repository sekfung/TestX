import { useState, useEffect, useRef } from 'react'
import { X, ChevronUp, Search, Trash2, Download, ChevronDown, Check, Usb, Play, Square, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLogStore, type LogEntry, LogLevel } from '@/stores/logStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import ReactJsonView from 'react-json-view'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'

// JSON格式化组件
interface JsonViewerProps {
  content: string
  collapsed?: boolean
}

function JsonViewer({ content, collapsed = true }: JsonViewerProps) {
  try {
    const jsonObject = JSON.parse(content)
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 my-1 max-w-full overflow-auto">
        <ReactJsonView
          src={jsonObject}
          theme="rjv-default"
          collapsed={collapsed ? 1 : false}
          displayDataTypes={false}
          displayObjectSize={false}
          enableClipboard={false}
          name={false}
          style={{ 
            fontSize: '11px', 
            background: 'transparent',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
          }}
        />
      </div>
    )
  } catch {
    return <span className="break-all">{content}</span>
  }
}

// SQL语法高亮组件
interface SqlHighlighterProps {
  content: string
}

function SqlHighlighter({ content }: SqlHighlighterProps) {
  // 简单检测是否为SQL语句
  const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE', 'JOIN', 'CREATE', 'ALTER', 'DROP']
  const isSql = sqlKeywords.some(keyword => 
    content.toUpperCase().includes(keyword)
  )

  if (isSql) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded p-2 my-1">
        <SyntaxHighlighter
          language="sql"
          style={tomorrow}
          customStyle={{
            fontSize: '11px',
            margin: 0,
            padding: 0,
            background: 'transparent',
            overflow: 'visible'
          }}
          wrapLongLines={true}
          PreTag="div"
        >
          {content}
        </SyntaxHighlighter>
      </div>
    )
  }

  return <span className="break-all">{content}</span>
}

// 智能内容格式化组件
interface SmartContentProps {
  content: string
}

function SmartContent({ content }: SmartContentProps) {
  // 首先尝试混合内容提取
  const mixedResult = (() => {
    if (!content.includes('{') && !content.includes('[')) {
      return null
    }
    
    // 查找可能的JSON开始位置（{ 或 [）
    let jsonStart = -1
    let jsonEnd = -1
    let braceCount = 0
    let bracketCount = 0
    let inJson = false
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i]
      
      if (char === '{' && !inJson) {
        jsonStart = i
        inJson = true
        braceCount = 1
      } else if (char === '[' && !inJson) {
        jsonStart = i
        inJson = true
        bracketCount = 1
      } else if (inJson) {
        if (char === '{') {
          braceCount++
        } else if (char === '}') {
          braceCount--
          if (braceCount === 0 && bracketCount === 0) {
            jsonEnd = i + 1
            break
          }
        } else if (char === '[') {
          bracketCount++
        } else if (char === ']') {
          bracketCount--
          if (bracketCount === 0 && braceCount === 0) {
            jsonEnd = i + 1
            break
          }
        }
      }
    }
    
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const potentialJson = content.substring(jsonStart, jsonEnd)
      try {
        const parsed = JSON.parse(potentialJson)
        if (typeof parsed === 'object' && parsed !== null) {
          return {
            beforeJson: content.substring(0, jsonStart).trim(),
            json: potentialJson,
            afterJson: content.substring(jsonEnd).trim()
          }
        }
      } catch {
        // JSON解析失败，返回null
      }
    }
    
    return null
  })()
  
  // 如果找到了混合内容中的JSON，显示分离的内容
  if (mixedResult) {
    return (
      <div className="space-y-1">
        {mixedResult.beforeJson && (
          <div className="text-gray-700 dark:text-gray-300">
            {mixedResult.beforeJson}
          </div>
        )}
        <JsonViewer content={mixedResult.json} collapsed={true} />
        {mixedResult.afterJson && (
          <div className="text-gray-700 dark:text-gray-300">
            {mixedResult.afterJson}
          </div>
        )}
      </div>
    )
  }

  // 更严格的纯JSON检测
  const isJson = (() => {
    const trimmed = content.trim()
    if (!trimmed) return false
    
    // 必须以 { 或 [ 开头，以 } 或 ] 结尾
    if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
          (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
      return false
    }
    
    try {
      const parsed = JSON.parse(trimmed)
      // 确保解析出的是对象或数组，而不是简单的字符串或数字
      return typeof parsed === 'object' && parsed !== null
    } catch {
      return false
    }
  })()

  // 检测SQL - 更精确的SQL检测
  const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'SHOW', 'DESCRIBE']
  const isSql = sqlKeywords.some(keyword => {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i')
    return pattern.test(content)
  })

  if (isJson) {
    return <JsonViewer content={content.trim()} collapsed={true} />
  }
  
  if (isSql) {
    return <SqlHighlighter content={content} />
  }

  return <span className="break-all">{content}</span>
}

export function LogConsole() {
  const { isConsoleOpen, setConsoleOpen, logs, clearLogs, exportLogs } = useLogStore()
  const [isMinimized, setIsMinimized] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLevels, setSelectedLevels] = useState<Set<LogLevel>>(
    new Set(['debug', 'info', 'warn', 'error'])
  )
  const [selectedTypes, setSelectedTypes] = useState<Set<'serial' | 'software'>>(
    new Set(['serial', 'software'])
  )
  // 模块筛选状态
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set())
  const [isSourceDropdownOpen, setIsSourceDropdownOpen] = useState(false)
  const [height, setHeight] = useState(300)
  const [isResizing, setIsResizing] = useState(false)
  
  // 串口监控状态
  const [availablePorts, setAvailablePorts] = useState<string[]>([])
  const [selectedPort, setSelectedPort] = useState<string>('')
  const [selectedBaudRate, setSelectedBaudRate] = useState<number>(115200)
  const [isPortConnected, setIsPortConnected] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isSerialDropdownOpen, setIsSerialDropdownOpen] = useState(false)
  
  const consoleRef = useRef<HTMLDivElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const resizeHandleRef = useRef<HTMLDivElement>(null)
  
  // 常用波特率选项
  const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600]
  
  // 扫描可用串口
  const scanSerialPorts = async () => {
    setIsScanning(true)
    try {
      const { scanSerialPorts: scanPorts } = await import('../lib/tauri-api')
      const ports = await scanPorts()
      setAvailablePorts(ports)
      console.log('扫描串口完成:', ports)
    } catch (error) {
      console.error('扫描串口失败:', error)
      setAvailablePorts([])
    } finally {
      setIsScanning(false)
    }
  }
  
  // 连接串口
  const connectSerialPort = async () => {
    if (!selectedPort || !selectedBaudRate) {
      console.warn('请选择串口和波特率')
      return
    }
    
    try {
      const { connectSerialPort: connectPort } = await import('../lib/tauri-api')
      await connectPort(selectedPort, selectedBaudRate)
      setIsPortConnected(true)
      console.log(`已连接串口: ${selectedPort}, 波特率: ${selectedBaudRate}`)
    } catch (error) {
      console.error('连接串口失败:', error)
      setIsPortConnected(false)
    }
  }
  
  // 断开串口
  const disconnectSerialPort = async () => {
    if (!selectedPort) {
      console.warn('没有选择的串口')
      return
    }
    
    try {
      const { disconnectSerialPort: disconnectPort } = await import('../lib/tauri-api')
      await disconnectPort(selectedPort)
      setIsPortConnected(false)
      console.log('已断开串口连接')
    } catch (error) {
      console.error('断开串口失败:', error)
    }
  }

  // 获取所有可用的日志来源/模块
  const availableSources: string[] = Array.from(
    new Set(logs.filter(log => log.source).map(log => log.source!))
  ).sort()

  // 初始化时选择所有可用模块，并在有新模块时自动选择
  useEffect(() => {
    if (availableSources.length > 0) {
      setSelectedSources(new Set(availableSources))
    }
  }, [availableSources.join(',')])  // 当可用模块列表变化时重新执行

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current && isConsoleOpen && !isMinimized) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, isConsoleOpen, isMinimized])

  const toggleSource = (source: string) => {
    const newSources = new Set(selectedSources)
    if (newSources.has(source)) {
      newSources.delete(source)
    } else {
      newSources.add(source)
    }
    setSelectedSources(newSources)
  }

  const toggleAllSources = () => {
    if (selectedSources.size === availableSources.length) {
      // 如果全选，则取消全选
      setSelectedSources(new Set())
    } else {
      // 否则全选
      setSelectedSources(new Set(availableSources))
    }
  }

  // 键盘快捷键支持
  useEffect(() => {
    if (!isConsoleOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // ESC 关闭控制台
      if (event.key === 'Escape') {
        setConsoleOpen(false)
        event.preventDefault()
      }

      // Ctrl/Cmd + L 清空日志
      if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
        clearLogs()
        event.preventDefault()
      }

      // Ctrl/Cmd + E 导出日志
      if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
        handleExportLogs()
        event.preventDefault()
      }

      // Ctrl/Cmd + F 聚焦搜索框
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        const searchInput = document.querySelector('#log-search-input') as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
        event.preventDefault()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isConsoleOpen, clearLogs, setConsoleOpen, selectedLevels, selectedTypes, selectedSources, searchQuery])

  // 处理导出日志的函数
  const handleExportLogs = () => {
    exportLogs({
      levels: selectedLevels,
      types: selectedTypes,
      sources: selectedSources,
      searchQuery: searchQuery.trim() || undefined
    })
  }

  // 管理页面底部padding，避免内容被遮挡
  useEffect(() => {
    const htmlElement = document.documentElement
    const bodyElement = document.body
    
    if (isConsoleOpen && !isMinimized) {
      // 控制台打开且未最小化
      bodyElement.style.paddingBottom = `${height + 20}px`
      bodyElement.style.transition = 'padding-bottom 0.3s ease'
      
      // 添加CSS类来强制滚动
      bodyElement.classList.add('console-open', 'force-scroll')
      htmlElement.classList.add('force-scroll')
      
      // 强制确保页面可以滚动
      bodyElement.style.overflow = 'auto'
      bodyElement.style.overflowY = 'auto'
      bodyElement.style.overflowX = 'hidden'
      htmlElement.style.overflow = 'auto'
      htmlElement.style.overflowY = 'auto'
      htmlElement.style.overflowX = 'hidden'
      
      // 确保页面高度足够滚动
      bodyElement.style.minHeight = '100vh'
      
    } else if (isConsoleOpen && isMinimized) {
      // 控制台最小化
      bodyElement.style.paddingBottom = '60px'
      bodyElement.style.transition = 'padding-bottom 0.3s ease'
      
      // 添加CSS类来强制滚动
      bodyElement.classList.add('console-open', 'force-scroll')
      htmlElement.classList.add('force-scroll')
      
      // 确保页面可以滚动
      bodyElement.style.overflow = 'auto'
      bodyElement.style.overflowY = 'auto'
      bodyElement.style.overflowX = 'hidden'
      htmlElement.style.overflow = 'auto'
      htmlElement.style.overflowY = 'auto'
      htmlElement.style.overflowX = 'hidden'
      
    } else {
      // 控制台关闭，恢复默认
      bodyElement.style.paddingBottom = '0px'
      bodyElement.style.transition = 'padding-bottom 0.3s ease'
      
      // 移除CSS类
      bodyElement.classList.remove('console-open', 'force-scroll')
      htmlElement.classList.remove('force-scroll')
      
      // 恢复默认滚动行为
      bodyElement.style.overflow = ''
      bodyElement.style.overflowY = ''
      bodyElement.style.overflowX = ''
      htmlElement.style.overflow = ''
      htmlElement.style.overflowY = ''
      htmlElement.style.overflowX = ''
      bodyElement.style.minHeight = ''
    }

    // 清理函数
    return () => {
      if (!isConsoleOpen) {
        bodyElement.style.paddingBottom = '0px'
        bodyElement.style.transition = ''
        bodyElement.classList.remove('console-open', 'force-scroll')
        htmlElement.classList.remove('force-scroll')
        bodyElement.style.overflow = ''
        bodyElement.style.overflowY = ''
        bodyElement.style.overflowX = ''
        htmlElement.style.overflow = ''
        htmlElement.style.overflowY = ''
        htmlElement.style.overflowX = ''
        bodyElement.style.minHeight = ''
      }
    }
  }, [isConsoleOpen, isMinimized, height])

  // Handle resize with improved event handling
  useEffect(() => {
    if (!isConsoleOpen) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || isMinimized) return
      
      e.preventDefault()
      const newHeight = window.innerHeight - e.clientY
      const clampedHeight = Math.max(200, Math.min(600, newHeight))
      setHeight(clampedHeight)
      
      // 实时更新页面padding
      document.body.style.paddingBottom = `${clampedHeight + 20}px`
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (isResizing) {
        e.preventDefault()
        setIsResizing(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        
        // resize结束后刷新滚动状态
        setTimeout(() => {
          // 强制重新计算滚动条
          const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop
          window.scrollTo(0, currentScrollTop + 1)
          window.scrollTo(0, currentScrollTop)
          
          // 触发resize事件，让浏览器重新计算布局
          window.dispatchEvent(new Event('resize'))
        }, 50)
      }
    }

    if (isResizing) {
      document.body.style.cursor = 'ns-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove, { passive: false })
      document.addEventListener('mouseup', handleMouseUp, { passive: false })
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (isResizing) {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }
  }, [isResizing, isMinimized, isConsoleOpen])

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (target && !target.closest('.module-dropdown')) {
        setIsSourceDropdownOpen(false)
      }
      if (target && !target.closest('.serial-dropdown')) {
        setIsSerialDropdownOpen(false)
      }
    }

    if (isSourceDropdownOpen || isSerialDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isSourceDropdownOpen, isSerialDropdownOpen])

  if (!isConsoleOpen) return null

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.source?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLevel = selectedLevels.has(log.level)
    const matchesType = selectedTypes.has(log.type)
    // 模块筛选逻辑
    const matchesSource = !log.source || selectedSources.has(log.source)
    return matchesSearch && matchesLevel && matchesType && matchesSource
  })

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'error': return '❌'
      case 'warn': return '⚠️'
      case 'info': return 'ℹ️'
      case 'debug': return '🔍'
      default: return '📝'
    }
  }

  const toggleLevel = (level: LogLevel) => {
    const newLevels = new Set(selectedLevels)
    if (newLevels.has(level)) {
      newLevels.delete(level)
    } else {
      newLevels.add(level)
    }
    setSelectedLevels(newLevels)
  }

  const toggleType = (type: 'serial' | 'software') => {
    const newTypes = new Set(selectedTypes)
    if (newTypes.has(type)) {
      newTypes.delete(type)
    } else {
      newTypes.add(type)
    }
    setSelectedTypes(newTypes)
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'AliyunIoT': return '☁️'
      case 'TencentCloud': return '🌤️'
      case 'Speech': return '🎤'
      case 'Config': return '⚙️'
      case 'IoT': return '🌐'
      case 'AccuracyTest': return '🎯'
      case 'Python': return '🐍'
      case 'System': return '💻'
      case 'FileSystem': return '📁'
      case 'Database': return '🗄️'
      case 'Migration': return '📦'
      case 'Command': return '⚡'
      case 'LogSystem': return '📝'
      default: return '🔧'
    }
  }

  const handleMinimizeToggle = () => {
    setIsMinimized(!isMinimized)
  }

  const handleClose = () => {
    setConsoleOpen(false)
  }

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!isMinimized) {
      setIsResizing(true)
    }
  }

  return (
    <div
      ref={consoleRef}
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl font-mono text-sm",
        "dark:bg-gray-900 dark:border-gray-700",
        "pointer-events-auto"
      )}
      style={{ 
        height: isMinimized ? 'auto' : height,
        zIndex: 9999
      }}
    >
      {/* Resize Handle */}
      {!isMinimized && (
        <div
          ref={resizeHandleRef}
          className="h-1 bg-gray-300 hover:bg-blue-500 cursor-ns-resize transition-colors select-none"
          onMouseDown={handleResizeStart}
          style={{ touchAction: 'none' }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            Console
          </Badge>
          <Badge variant="secondary">
            {filteredLogs.length}/{logs.length} 条日志
          </Badge>
          {/* 快捷键提示 */}
          <Badge variant="outline" className="text-xs hidden md:inline-flex" title="键盘快捷键">
            ⌨️ Ctrl+F:搜索 Ctrl+L:清空 Ctrl+E:导出筛选结果
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMinimizeToggle}
          >
            <ChevronUp className={cn("h-4 w-4 transition-transform", 
              isMinimized && "rotate-180")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap">
            {/* Search */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <Input
                id="log-search-input"
                placeholder="搜索日志..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {/* 串口监控控制 */}
            <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-2">
              {/* 串口选择下拉菜单 */}
              <div className="relative serial-dropdown">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs justify-between min-w-[140px]"
                  onClick={() => setIsSerialDropdownOpen(!isSerialDropdownOpen)}
                >
                  <div className="flex items-center gap-1">
                    <Usb className="h-3 w-3" />
                    <span>{selectedPort || '选择串口'}</span>
                  </div>
                  <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
                
                {isSerialDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-[99999] p-4">
                    {/* 串口扫描 */}
                    <div className="flex items-center gap-2 mb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={scanSerialPorts}
                        disabled={isScanning}
                        className="h-8 flex-1"
                      >
                        <RefreshCw className={cn("h-3 w-3 mr-1", isScanning && "animate-spin")} />
                        {isScanning ? '扫描中...' : '扫描串口'}
                      </Button>
                    </div>
                    
                    {/* 串口列表 */}
                    <div className="mb-3">
                      <div className="text-xs text-gray-500 mb-2">可用串口:</div>
                      {availablePorts.length === 0 ? (
                        <div className="text-xs text-gray-400 py-2">暂无可用串口，请点击扫描</div>
                      ) : (
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {availablePorts.map((port) => (
                            <div
                              key={port}
                              className={cn(
                                "flex items-center px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded",
                                selectedPort === port && "bg-blue-100 dark:bg-blue-900"
                              )}
                              onClick={() => setSelectedPort(port)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-3 w-3",
                                  selectedPort === port ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span>{port}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* 波特率选择 */}
                    <div className="mb-4">
                      <div className="text-xs text-gray-500 mb-2">波特率:</div>
                      <div className="grid grid-cols-4 gap-2">
                        {baudRates.map((rate) => (
                          <Button
                            key={rate}
                            variant={selectedBaudRate === rate ? "default" : "outline"}
                            size="sm"
                            onClick={() => setSelectedBaudRate(rate)}
                            className="h-8 text-xs px-2 min-w-[60px]"
                          >
                            {rate}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    {/* 连接控制 */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant={isPortConnected ? "destructive" : "default"}
                        size="sm"
                        onClick={isPortConnected ? disconnectSerialPort : connectSerialPort}
                        disabled={!selectedPort}
                        className="h-8 flex-1"
                      >
                        {isPortConnected ? (
                          <>
                            <Square className="h-3 w-3 mr-1" />
                            断开连接
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 mr-1" />
                            连接串口
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Level Filters */}
            <div className="flex items-center gap-1 flex-wrap">
              {(['error', 'warn', 'info', 'debug'] as LogLevel[]).map((level) => (
                <Button
                  key={level}
                  variant={selectedLevels.has(level) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleLevel(level)}
                  className="h-8 px-2 text-xs"
                >
                  {getLevelIcon(level)} {level.toUpperCase()}
                </Button>
              ))}
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-1">
              <Button
                variant={selectedTypes.has('serial') ? "default" : "outline"}
                size="sm"
                onClick={() => toggleType('serial')}
                className="h-8 px-2 text-xs"
              >
                串口
              </Button>
              <Button
                variant={selectedTypes.has('software') ? "default" : "outline"}
                size="sm"
                onClick={() => toggleType('software')}
                className="h-8 px-2 text-xs"
              >
                软件
              </Button>
            </div>

            {/* 模块筛选下拉菜单 */}
            <div className="relative module-dropdown">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs justify-between min-w-[120px]"
                onClick={() => {
                  console.log('模块筛选按钮点击', { isSourceDropdownOpen, availableSources })
                  setIsSourceDropdownOpen(!isSourceDropdownOpen)
                }}
              >
                <div className="flex items-center gap-1">
                  🔧 模块筛选
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {selectedSources.size}/{availableSources.length}
                  </Badge>
                </div>
                <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
              </Button>
              
              {isSourceDropdownOpen && (
                <div 
                  className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-[99999] max-h-64 overflow-auto"
                  style={{ zIndex: 99999 }}
                >
                  <div className="p-2">
                    <Input
                      placeholder="搜索模块..."
                      className="h-8 text-sm mb-2"
                      onChange={(e) => {
                        // 简单的搜索过滤逻辑
                        // 可以后续添加
                      }}
                    />
                    
                    {availableSources.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">暂无可用模块</div>
                    ) : (
                      <div className="space-y-1">
                        {/* 全选选项 */}
                        <div 
                          className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded"
                          onClick={() => {
                            console.log('全选按钮点击')
                            toggleAllSources()
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSources.size === availableSources.length
                                ? "opacity-100"
                                : "opacity-0"
                            )}
                          />
                          <div className="flex items-center gap-2">
                            <span className="font-medium">全选/取消全选</span>
                            <Badge variant="outline" className="text-xs">
                              {selectedSources.size}/{availableSources.length}
                            </Badge>
                          </div>
                        </div>
                        
                        {/* 模块选项 */}
                        {availableSources.map((source) => (
                          <div
                            key={source}
                            className="flex items-center px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded"
                            onClick={() => {
                              console.log('模块点击:', source)
                              toggleSource(source)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedSources.has(source) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center gap-2">
                              <span>{getSourceIcon(source)}</span>
                              <span>{source}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>



            {/* Actions */}
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={clearLogs}
                className="h-8 px-2"
                title="清空日志"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportLogs}
                className="h-8 px-2"
                title={`导出日志 (${filteredLogs.length}/${logs.length} 条)`}
              >
                <Download className="h-3 w-3" />
                {filteredLogs.length !== logs.length && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {filteredLogs.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Log Content */}
          <div
            ref={logContainerRef}
            className="flex-1 overflow-y-auto p-2 space-y-1"
            style={{ height: height - 100 }}
          >
            {filteredLogs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                {logs.length === 0 ? '暂无日志记录' : '没有匹配的日志记录'}
              </div>
            ) : (
              filteredLogs.map((log) => (
                <LogEntry key={log.id} log={log} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

interface LogEntryProps {
  log: LogEntry
}

function LogEntry({ log }: LogEntryProps) {
  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'error': return '❌'
      case 'warn': return '⚠️'
      case 'info': return 'ℹ️'
      case 'debug': return '🔍'
      default: return '📝'
    }
  }

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'error': return 'text-red-600'
      case 'warn': return 'text-yellow-600'
      case 'info': return 'text-blue-600'
      case 'debug': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getTypeColor = (type: 'serial' | 'software') => {
    return type === 'serial' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'
  }

  // 获取模块图标
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'AliyunIoT': return '☁️'
      case 'TencentCloud': return '🌤️'
      case 'Speech': return '🎤'
      case 'Config': return '⚙️'
      case 'IoT': return '🌐'
      case 'AccuracyTest': return '🎯'
      case 'Python': return '🐍'
      case 'System': return '💻'
      case 'FileSystem': return '📁'
      case 'Database': return '🗄️'
      case 'Migration': return '📦'
      case 'Command': return '⚡'
      case 'LogSystem': return '📝'
      default: return '🔧'
    }
  }

  // 获取模块颜色
  const getSourceColor = (source: string) => {
    switch (source) {
      case 'AliyunIoT': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'TencentCloud': return 'bg-cyan-100 text-cyan-800 border-cyan-200'
      case 'Speech': return 'bg-pink-100 text-pink-800 border-pink-200'
      case 'Config': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'IoT': return 'bg-green-100 text-green-800 border-green-200'
      case 'AccuracyTest': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Python': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'System': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'FileSystem': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case 'Database': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'Migration': return 'bg-teal-100 text-teal-800 border-teal-200'
      case 'Command': return 'bg-lime-100 text-lime-800 border-lime-200'
      case 'LogSystem': return 'bg-slate-100 text-slate-800 border-slate-200'
      default: return 'bg-neutral-100 text-neutral-800 border-neutral-200'
    }
  }

  return (
    <div className="flex items-start gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded text-xs group">
      <span className="text-gray-400 font-mono whitespace-nowrap">
        {log.timestamp.toLocaleTimeString('zh-CN', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })}.{log.timestamp.getMilliseconds().toString().padStart(3, '0')}
      </span>
      <span className={cn("font-bold", getLevelColor(log.level))}>
        {getLevelIcon(log.level)}
      </span>
      <Badge variant="secondary" className={cn("text-xs px-1 py-0", getTypeColor(log.type))}>
        {log.type === 'serial' ? '串口' : '软件'}
      </Badge>
      {log.source && (
        <Badge 
          variant="outline" 
          className={cn("text-xs px-2 py-0 font-mono border", getSourceColor(log.source))}
          title={`模块: ${log.source}`}
        >
          {getSourceIcon(log.source)} {log.source}
        </Badge>
      )}
      <div className="flex-1 min-w-0">
        <SmartContent content={log.message} />
      </div>
    </div>
  )
}