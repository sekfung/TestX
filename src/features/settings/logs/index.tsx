import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useLogStore, LogLevel } from '@/stores/logStore'
import ContentSection from '../components/content-section'
import { FolderOpen, Download, Trash2, Eye, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function SettingsLogs() {
  const { settings, updateSettings, logs, clearLogs, exportLogs, toggleConsole } = useLogStore()
  const [localPath, setLocalPath] = useState(settings.logFileLocation)
  const [pathStatus, setPathStatus] = useState<'valid' | 'invalid' | 'unknown'>('unknown')

  const validatePath = (path: string) => {
    if (!path) return 'invalid'
    
    // 检查路径格式
    const isAbsolute = path.startsWith('/') || path.match(/^[A-Za-z]:[\\/]/) || path.startsWith('~')
    const isRelative = !isAbsolute && !path.match(/^[./]/) // 不以 ./ 开头的相对路径
    const hasInvalidChars = /[<>:"|?*]/.test(path)
    
    // 允许绝对路径和相对路径
    if (!isAbsolute && !isRelative) return 'invalid'
    if (hasInvalidChars) return 'invalid'
    
    return 'valid'
  }

  const getSmartDefaultPath = (folderName: string) => {
    const userAgent = navigator.userAgent.toLowerCase()
    const platform = navigator.platform.toLowerCase()
    
    // 获取当前用户的用户名（如果可能）
    let username = 'your-username'
    try {
      // 在某些环境下可能可以获取到用户信息
      if (navigator.userAgent.includes('Electron') || window.location.hostname === 'localhost') {
        // 在Electron或本地环境中可能可以获取更准确的信息
        username = 'your-username' // 保持占位符
      }
    } catch (e) {
      // 忽略错误，使用默认值
    }
    
    if (userAgent.includes('mac') || platform.includes('mac')) {
      return `/Users/${username}/Documents/${folderName}`
    } else if (userAgent.includes('win') || platform.includes('win')) {
      return `C:\\Users\\${username}\\Documents\\${folderName}`
    } else {
      return `/home/${username}/Documents/${folderName}`
    }
  }

  const getCurrentUserPath = () => {
    const platform = navigator.platform.toLowerCase()
    const userAgent = navigator.userAgent.toLowerCase()
    
    if (userAgent.includes('mac') || platform.includes('mac')) {
      return '/Users/[您的用户名]/Documents'
    } else if (userAgent.includes('win') || platform.includes('win')) {
      return 'C:\\Users\\[您的用户名]\\Documents'
    } else {
      return '/home/[您的用户名]/Documents'
    }
  }

  const handlePathSelect = async () => {
    try {
      if ('showDirectoryPicker' in window) {
        // 使用 Web File System API (Chrome) - 只选择文件夹
        const dirHandle = await (window as any).showDirectoryPicker()
        
        // 构建智能路径建议
        const basePath = getCurrentUserPath()
        const suggestedPath = getSmartDefaultPath(dirHandle.name)
        
        // 提示用户确认或修正路径，提供更清晰的说明
        const userPath = prompt(
          `✅ 已选择文件夹: ${dirHandle.name}\n\n由于浏览器安全限制，请输入该文件夹的完整绝对路径:\n\n💡 常用路径格式: ${basePath}\\${dirHandle.name}\n\n请在下方输入或修改路径:`,
          suggestedPath
        )
        
        if (userPath) {
          setLocalPath(userPath)
          setPathStatus(validatePath(userPath))
          updateSettings({ logFileLocation: userPath })
          toast.success(`文件夹路径已设置: ${dirHandle.name}`)
        }
      } else {
        // 降级方案：使用传统文件夹选择器
        const input = document.createElement('input')
        input.type = 'file'
        input.webkitdirectory = true // 只允许选择文件夹
        input.style.display = 'none'
        
        input.onchange = (e) => {
          const target = e.target as HTMLInputElement
          if (target.files && target.files.length > 0) {
            const file = target.files[0]
            const relativePath = file.webkitRelativePath
            const folderName = relativePath.split('/')[0]
            
            // 提供智能路径建议
            const basePath = getCurrentUserPath()
            let suggestedPath = getSmartDefaultPath(folderName)
            
            // 如果文件有完整的路径信息，尝试使用它（某些环境下可能有path属性）
            if ((file as any).path) {
              const fullPath = (file as any).path.replace(file.name, '').replace(/\/$/, '')
              suggestedPath = fullPath
            }
            
            const userPath = prompt(
              `✅ 已选择文件夹: ${folderName}\n\n💡 常用路径格式: ${basePath}\\${folderName}\n\n请输入该文件夹的完整绝对路径:`,
              suggestedPath
            )
            
            if (userPath) {
              setLocalPath(userPath)
              setPathStatus(validatePath(userPath))
              updateSettings({ logFileLocation: userPath })
              toast.success(`文件夹路径已设置: ${folderName}`)
            }
          }
          document.body.removeChild(input)
        }
        
        document.body.appendChild(input)
        input.click()
      }
    } catch (error) {
      console.error('文件夹选择失败:', error)
      const defaultPath = settings.logFileLocation || getSmartDefaultPath('logs')
      const manualPath = prompt(
        '❌ 文件夹选择失败\n\n请手动输入日志文件夹的完整绝对路径:\n\n例如: ' + getCurrentUserPath() + '\\logs', 
        defaultPath
      )
      if (manualPath) {
        setLocalPath(manualPath)
        setPathStatus(validatePath(manualPath))
        updateSettings({ logFileLocation: manualPath })
        toast.success('日志保存路径已设置')
      }
    }
  }

  const handlePathChange = () => {
    const status = validatePath(localPath)
    setPathStatus(status)
    if (status === 'valid') {
      updateSettings({ logFileLocation: localPath })
    }
  }

  const handlePathInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPath = e.target.value
    setLocalPath(newPath)
    setPathStatus(validatePath(newPath))
  }

  const handleClearLogs = () => {
    if (logs.length === 0) return
    
    const confirmed = confirm(`确定要清空所有日志吗？\n\n当前有 ${logs.length} 条日志，此操作不可撤销。`)
    if (confirmed) {
      clearLogs()
      toast.success('已清空所有日志')
    }
  }

  const handleExportLogs = () => {
    console.log('点击导出按钮，当前日志数量:', logs.length)
    if (logs.length === 0) {
      toast.warning('没有日志可导出')
      return
    }
    exportLogs()
  }

  const logLevelOptions: { value: LogLevel; label: string; description: string }[] = [
    { value: 'debug', label: 'Debug', description: '显示所有日志信息，包括调试详情' },
    { value: 'info', label: 'Info', description: '显示常规信息、警告和错误' },
    { value: 'warn', label: 'Warning', description: '仅显示警告和错误信息' },
    { value: 'error', label: 'Error', description: '仅显示错误信息' },
  ]

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'debug': return 'bg-gray-100 text-gray-800'
      case 'info': return 'bg-blue-100 text-blue-800'
      case 'warn': return 'bg-yellow-100 text-yellow-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <ContentSection
      title="日志设置"
      desc="配置日志记录选项，管理串口和软件运行日志的保存和显示。"
    >
      <div className="space-y-6">
        {/* 日志级别设置 */}
        <Card>
          <CardHeader>
            <CardTitle>日志级别</CardTitle>
            <CardDescription>
              选择要记录和显示的日志信息级别
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <Label htmlFor="log-level">当前级别</Label>
              <Select
                value={settings.logLevel}
                onValueChange={(value: LogLevel) => updateSettings({ logLevel: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择日志级别" />
                </SelectTrigger>
                <SelectContent>
                  {logLevelOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Badge className={getLevelColor(option.value)} variant="secondary">
                          {option.label}
                        </Badge>
                        <span>{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 日志类型设置 */}
        <Card>
          <CardHeader>
            <CardTitle>日志类型</CardTitle>
            <CardDescription>
              选择要保存的日志类型
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="serial-logs">串口日志</Label>
                <p className="text-sm text-muted-foreground">
                  记录串口通信的输入输出数据
                </p>
              </div>
              <Switch
                id="serial-logs"
                checked={settings.saveSerialLogs}
                onCheckedChange={(checked) => updateSettings({ saveSerialLogs: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="software-logs">软件运行日志</Label>
                <p className="text-sm text-muted-foreground">
                  记录应用程序的运行状态和错误信息（包括Rust后端日志）
                </p>
              </div>
              <Switch
                id="software-logs"
                checked={settings.saveSoftwareLogs}
                onCheckedChange={(checked) => updateSettings({ saveSoftwareLogs: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* 存储设置 */}
        <Card>
          <CardHeader>
            <CardTitle>存储设置</CardTitle>
            <CardDescription>
              配置日志文件的保存位置和限制
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="log-path">日志文件夹保存位置</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    id="log-path"
                    value={localPath}
                    onChange={handlePathInputChange}
                    onBlur={handlePathChange}
                    placeholder="例如: Documents/logs 或 /Users/username/Documents/logs"
                    className={pathStatus === 'invalid' ? 'border-red-500' : pathStatus === 'valid' ? 'border-green-500' : ''}
                  />
                  {pathStatus !== 'unknown' && (
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                      {pathStatus === 'valid' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={handlePathSelect}
                  className="px-3 whitespace-nowrap"
                  title="选择文件夹"
                >
                  <FolderOpen className="h-4 w-4" />
                  选择文件夹
                </Button>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  支持相对路径和绝对路径。相对路径会自动基于用户主目录展开。
                </p>
                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded border">
                  <p className="font-medium mb-1">支持的路径格式：</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li><strong>相对路径</strong>：Documents/logs → ~/Documents/logs</li>
                    <li><strong>绝对路径</strong>：/Users/username/Documents/logs</li>
                    <li><strong>波浪号路径</strong>：~/Documents/logs</li>
                    <li>日志文件自动命名：logs_YYYY-MM-DD_HHMMSS.txt</li>
                  </ul>
                </div>
                {pathStatus === 'invalid' && (
                  <p className="text-xs text-red-500">
                    请输入有效的文件夹绝对路径，例如: /Users/username/Documents/logs
                  </p>
                )}
                {pathStatus === 'valid' && (
                  <p className="text-xs text-green-600">
                    文件夹路径格式正确 ✓
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="max-entries">最大日志条数</Label>
              <Select
                value={settings.maxLogEntries.toString()}
                onValueChange={(value) => updateSettings({ maxLogEntries: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="500">500 条</SelectItem>
                  <SelectItem value="1000">1000 条</SelectItem>
                  <SelectItem value="2000">2000 条</SelectItem>
                  <SelectItem value="5000">5000 条</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 日志管理 */}
        <Card>
          <CardHeader>
            <CardTitle>日志管理</CardTitle>
            <CardDescription>
              查看和管理当前的日志记录
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                当前已记录 <Badge variant="outline">{logs.length}</Badge> 条日志
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleConsole}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  查看控制台
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportLogs}
                  disabled={logs.length === 0}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  导出日志
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearLogs}
                  disabled={logs.length === 0}
                  className="flex items-center gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  清空日志
                </Button>
              </div>
            </div>
            
            {/* 导出说明 */}
            <div className="text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-3 rounded border border-amber-200 dark:border-amber-800">
              <p className="font-medium text-amber-900 dark:text-amber-100 mb-2">📁 导出日志说明：</p>
              <ul className="space-y-1 text-amber-800 dark:text-amber-200">
                <li><strong>现代浏览器</strong>（Chrome/Edge）：点击导出后可选择保存位置，建议保存到上面设置的文件夹路径</li>
                <li><strong>其他浏览器</strong>：文件将下载到默认下载目录，您需要手动移动到设置的路径</li>
                <li><strong>文件格式</strong>：导出的文件包含完整的日志信息和设置的目标路径</li>
                <li><strong>自动命名</strong>：文件名格式为 logs_YYYY-MM-DD_HHMMSS.txt</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </ContentSection>
  )
} 