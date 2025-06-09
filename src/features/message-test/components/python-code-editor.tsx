import { useRef, useState, useEffect } from 'react'
import { Editor } from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { IconCode, IconPlayerPlay, IconRefresh, IconFileCode, IconAlertCircle, IconCheck, IconMaximize, IconSettings, IconPalette, IconTypography } from '@tabler/icons-react'
import { invoke } from '@tauri-apps/api/core'
import { FullscreenCodeEditor } from '@/components/ui/fullscreen-code-editor'

interface PythonExecutionResult {
  success: boolean
  result?: {
    topic: string
    qos_level: number
    payload: string
    product_key: string
    device_name: string
  }
  error?: string
  logs: string[]
}

interface PythonCodeEditorProps {
  initialCode?: string
  onCodeChange?: (code: string) => void
  onExecuteSuccess?: (result: { topic: string; qos_level: number; payload: string; product_key: string; device_name: string }) => void
  onExecuteError?: (error: string) => void
}

export function PythonCodeEditor({ 
  initialCode = '', 
  onCodeChange, 
  onExecuteSuccess, 
  onExecuteError 
}: PythonCodeEditorProps) {
  const editorRef = useRef<any>(null)
  const [code, setCode] = useState(initialCode)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<PythonExecutionResult | null>(null)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  
  // 编辑器设置状态
  const [showSettings, setShowSettings] = useState(false)
  const [currentTheme, setCurrentTheme] = useState('vs-dark')
  const [fontSize, setFontSize] = useState(14)

  // 主题选项
  const themeOptions = [
    { value: 'vs-dark', label: '深色主题' },
    { value: 'vs-light', label: '浅色主题' },
    { value: 'hc-black', label: '高对比度黑色' },
    { value: 'hc-light', label: '高对比度白色' }
  ]

  // 字体大小选项
  const fontSizeOptions = [
    { value: 12, label: '12px (小)' },
    { value: 14, label: '14px (默认)' },
    { value: 16, label: '16px (中)' },
    { value: 18, label: '18px (大)' },
    { value: 20, label: '20px (超大)' },
    { value: 24, label: '24px (巨大)' }
  ]

  // 当initialCode变化时更新代码
  useEffect(() => {
    if (initialCode && initialCode !== code) {
      setCode(initialCode)
    }
  }, [initialCode])

  // 组件挂载时加载默认模板（如果没有初始代码）
  useEffect(() => {
    if (!initialCode) {
      loadTemplate()
    }
  }, [initialCode])

  // 代码变化时通知父组件
  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || ''
    console.log('PythonCodeEditor - 代码变化:', {
      newCodeLength: newCode.length,
      hasOnCodeChange: !!onCodeChange,
      codePreview: newCode.substring(0, 100)
    })
    setCode(newCode)
    onCodeChange?.(newCode)
  }

  // 全屏编辑器代码保存处理
  const handleFullscreenCodeChange = (newCode: string) => {
    setCode(newCode)
    onCodeChange?.(newCode)
  }

  // 主题变化处理
  const handleThemeChange = (newTheme: string) => {
    setCurrentTheme(newTheme)
  }

  // 字体大小变化处理
  const handleFontSizeChange = (newSize: string) => {
    const size = parseInt(newSize)
    setFontSize(size)
    // 实时更新编辑器字体大小
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize: size })
    }
  }

  const loadTemplate = async () => {
    setIsLoadingTemplate(true)
    try {
      const template = await invoke<string>('get_python_template')
      console.log('PythonCodeEditor - 加载模板:', {
        templateLength: template.length,
        hasOnCodeChange: !!onCodeChange,
        templatePreview: template.substring(0, 100)
      })
      setCode(template)
      onCodeChange?.(template)  // 通知父组件代码已更改
      setExecutionResult(null)
    } catch (error) {
      console.error('加载Python模板失败:', error)
      onExecuteError?.(`加载模板失败: ${error}`)
    } finally {
      setIsLoadingTemplate(false)
    }
  }

  const executeCode = async () => {
    if (!code.trim()) {
      onExecuteError?.('请输入Python代码')
      return
    }

    setIsExecuting(true)
    setExecutionResult(null)

    try {
      // 使用支持变量替换的新命令
      const result = await invoke<PythonExecutionResult>('execute_python_code_with_variables', {
        code: code
      })

      setExecutionResult(result)

      if (result.success && result.result) {
        onExecuteSuccess?.(result.result)
      } else {
        onExecuteError?.(result.error || '执行失败')
      }
    } catch (error) {
      console.error('执行Python代码失败:', error)
      const errorMessage = `执行失败: ${error}`
      setExecutionResult({
        success: false,
        error: errorMessage,
        logs: []
      })
      onExecuteError?.(errorMessage)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor
    // 设置编辑器主题和选项
    editor.updateOptions({
      fontSize: fontSize,
      lineNumbers: 'on',
      rulers: [80, 120],
      wordWrap: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      // 启用智能补全相关功能
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true
      },
      parameterHints: {
        enabled: true
      },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
      wordBasedSuggestions: true,
      // 启用括号匹配
      matchBrackets: 'always',
      // 启用代码折叠
      folding: true,
      foldingHighlight: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      foldingImportsByDefault: false
    })
  }

  const formatPayload = (payload: string) => {
    try {
      const parsed = JSON.parse(payload)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return payload
    }
  }

  return (
    <div className="space-y-4">
      {/* 代码编辑器区域 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <IconCode className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Python 代码编辑器</CardTitle>
              <Badge variant="outline" className="text-xs">
                必须实现: generate_message()
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="text-xs text-blue-600 hover:text-blue-700"
                title="编辑器设置"
              >
                <IconSettings className="h-3 w-3 mr-1" />
                设置
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreenOpen(true)}
                className="text-xs"
                title="全屏编辑"
              >
                <IconMaximize className="h-3 w-3 mr-1" />
                全屏
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTemplate}
                disabled={isLoadingTemplate}
                className="text-xs"
              >
                <IconRefresh className="h-3 w-3 mr-1" />
                {isLoadingTemplate ? '加载中...' : '重置模板'}
              </Button>
              <Button
                onClick={executeCode}
                disabled={isExecuting || !code.trim()}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                <IconPlayerPlay className="h-3 w-3 mr-1" />
                {isExecuting ? '执行中...' : '执行代码'}
              </Button>
            </div>
          </div>
          
          {/* 设置面板 */}
          {showSettings && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center space-x-2 text-sm">
                    <IconPalette className="h-4 w-4" />
                    <span>主题</span>
                  </Label>
                  <Select value={currentTheme} onValueChange={handleThemeChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择主题" />
                    </SelectTrigger>
                    <SelectContent>
                      {themeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="flex items-center space-x-2 text-sm">
                    <IconTypography className="h-4 w-4" />
                    <span>字体大小</span>
                  </Label>
                  <Select value={fontSize.toString()} onValueChange={handleFontSizeChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="选择字体大小" />
                    </SelectTrigger>
                    <SelectContent>
                      {fontSizeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                设置仅在当前会话中有效 | 当前: {themeOptions.find(t => t.value === currentTheme)?.label} | {fontSize}px
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {/* 使用说明 */}
          <Alert className="mb-4 border-blue-200 bg-blue-50">
            <IconCode className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <div className="font-medium mb-1">📋 代码要求</div>
              <div className="text-sm space-y-1">
                <div>• 必须定义 <code className="bg-blue-100 px-1 rounded">generate_message()</code> 函数</div>
                <div>• 支持变量替换：使用 <code className="bg-blue-100 px-1 rounded">${'{变量名}'}</code> 格式，如 <code className="bg-blue-100 px-1 rounded">${'{PRODUCT_KEY}'}</code></div>
                <div>• 在设置 → 变量管理中配置变量值</div>
              </div>
            </AlertDescription>
          </Alert>
          
          {/* 编辑器容器 */}
          <div className="border rounded-md overflow-hidden">
            <Editor
              height="400px"
              defaultLanguage="python"
              value={code}
              onChange={handleCodeChange}
              onMount={handleEditorDidMount}
              theme={currentTheme}
              options={{
                fontSize: fontSize,
                lineNumbers: 'on',
                rulers: [80, 120],
                wordWrap: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 4,
                insertSpaces: true,
                detectIndentation: false,
                folding: true,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 3,
                glyphMargin: false,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 执行结果区域 */}
      {executionResult && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center space-x-2">
              <IconFileCode className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg">执行结果</CardTitle>
              {executionResult.success ? (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <IconCheck className="h-3 w-3 mr-1" />
                  成功
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-800 border-red-200">
                  <IconAlertCircle className="h-3 w-3 mr-1" />
                  失败
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {executionResult.success && executionResult.result ? (
              <div className="space-y-3">
                <Alert className="border-green-200 bg-green-50">
                  <IconCheck className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Python代码执行成功，已生成IoT消息参数
                  </AlertDescription>
                </Alert>
                
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      主题 (Topic)
                    </label>
                    <div className="p-3 bg-gray-50 border rounded-md font-mono text-sm break-all">
                      {executionResult.result.topic}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      QoS等级
                    </label>
                    <div className="p-3 bg-gray-50 border rounded-md">
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                        QoS {executionResult.result.qos_level}
                      </Badge>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      消息内容 (Payload)
                    </label>
                    <div className="p-3 bg-gray-50 border rounded-md">
                      <pre className="font-mono text-sm whitespace-pre-wrap text-gray-800">
                        {formatPayload(executionResult.result.payload)}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Alert className="border-red-200 bg-red-50">
                  <IconAlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <div className="font-medium mb-1">执行失败</div>
                    <div className="text-sm">{executionResult.error}</div>
                  </AlertDescription>
                </Alert>
                
                {/* 如果是generate_message函数相关的错误，显示帮助信息 */}
                {executionResult.error?.includes('generate_message') && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <IconCode className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      <div className="font-medium mb-2">💡 解决方法</div>
                      <div className="text-sm space-y-1">
                        <div>1. 确保代码中定义了 <code className="bg-yellow-100 px-1 rounded">generate_message()</code> 函数</div>
                        <div>2. 点击"重置模板"按钮查看标准模板</div>
                        <div>3. 函数必须返回包含 topic, qos_level, payload 的字典</div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* 全屏编辑器 */}
      <FullscreenCodeEditor
        isOpen={isFullscreenOpen}
        onClose={() => setIsFullscreenOpen(false)}
        code={code}
        onCodeChange={handleFullscreenCodeChange}
        title="Python 代码编辑器 - 全屏模式"
        language="python"
        theme={currentTheme}
      />
    </div>
  )
}