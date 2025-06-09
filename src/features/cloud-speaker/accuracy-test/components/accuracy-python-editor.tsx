import { useRef, useState, useEffect } from 'react'
import { Editor } from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IconCode, IconPlayerPlay, IconRefresh, IconAlertCircle, IconMaximize, IconSettings, IconPalette, IconTypography } from '@tabler/icons-react'
import { invoke } from '@tauri-apps/api/core'
import { FullscreenCodeEditor } from '@/components/ui/fullscreen-code-editor'

interface PythonExecutionResult {
  success: boolean
  expected_text?: string
  error?: string
  logs: string[]
  result?: {
    topic: string
    qos_level: number
    payload: string
    product_key: string
    device_name: string
  } | null
}

interface AccuracyPythonEditorProps {
  initialCode?: string
  onCodeChange?: (code: string) => void
  onExecuteSuccess?: (result: PythonExecutionResult) => void
  onExecuteError?: (error: string) => void
}

export function AccuracyPythonEditor({ 
  initialCode = '', 
  onCodeChange, 
  onExecuteSuccess, 
  onExecuteError 
}: AccuracyPythonEditorProps) {
  const editorRef = useRef<any>(null)
  const [code, setCode] = useState(initialCode)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<PythonExecutionResult | null>(null)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)
  
  // 编辑器设置状态
  const [showSettings, setShowSettings] = useState(false)
  const [currentTheme, setCurrentTheme] = useState('vs-light')
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
      const template = await invoke<string>('get_accuracy_test_python_template')
      setCode(template)
      onCodeChange?.(template)
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
      // 执行代码同时获取期望文本和IoT消息参数（确保一致性）
      const result = await invoke<PythonExecutionResult>('execute_accuracy_test_python_code', {
        code: code
      })

      if (result.success) {
        // 从同一次执行中获取期望文本和IoT参数
        const combinedResult: PythonExecutionResult = {
          success: true,
          expected_text: result.expected_text,
          error: undefined,
          logs: result.logs || [],
          result: result.result // 使用同一次执行的IoT参数
        }

        setExecutionResult(combinedResult)
        onExecuteSuccess?.(combinedResult)
      } else {
        setExecutionResult(result)
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

  return (
    <div className="space-y-4">
      {/* 代码编辑器区域 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <IconCode className="h-5 w-5 text-green-600" />
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
                {isExecuting ? '执行中...' : '测试代码'}
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
          <Alert className="mb-4 border-green-200 bg-green-50">
            <IconCode className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="font-medium mb-1">📋 代码要求</div>
              <div className="text-sm space-y-1">
                <div>• 必须定义 <code className="bg-blue-100 px-1 rounded">generate_message()</code> 函数</div>
                <div>• 使用前，请根据实际需求修改代码中的设备配置信息</div>
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
                minimap: { enabled: false },
                fontSize: fontSize,
                lineNumbers: 'on',
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 执行结果显示 */}
      {executionResult && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center space-x-2">
              <span>执行结果</span>
              <Badge variant={executionResult.success ? "default" : "destructive"}>
                {executionResult.success ? "成功" : "失败"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {executionResult.success ? (
              <div className="space-y-4">
                {/* 期望文本 */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-green-700">生成的期望文本:</div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <code className="text-green-800">{executionResult.expected_text}</code>
                  </div>
                </div>

                {/* IoT消息参数 */}
                {executionResult.result && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-blue-700">生成的IoT消息参数:</div>
                    
                    <div className="grid gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          主题 (Topic)
                        </label>
                        <div className="p-2 bg-gray-50 border rounded-md font-mono text-xs break-all">
                          {executionResult.result.topic}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">
                            QoS等级
                          </label>
                          <div className="p-2 bg-gray-50 border rounded-md">
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                              QoS {executionResult.result.qos_level}
                            </Badge>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">
                            Product Key
                          </label>
                          <div className="p-2 bg-gray-50 border rounded-md font-mono text-xs">
                            {executionResult.result.product_key}
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          Device Name
                        </label>
                        <div className="p-2 bg-gray-50 border rounded-md font-mono text-xs">
                          {executionResult.result.device_name}
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          消息内容 (Payload)
                        </label>
                        <div className="p-2 bg-gray-50 border rounded-md max-h-32 overflow-y-auto">
                          <pre className="font-mono text-xs whitespace-pre-wrap text-gray-800">
                            {JSON.stringify(JSON.parse(executionResult.result.payload), null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm font-medium text-red-700">错误信息:</div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <code className="text-red-800 text-sm">{executionResult.error}</code>
                </div>
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
        title="准确性测试 Python 代码编辑器 - 全屏模式"
        language="python"
        theme={currentTheme}
      />
    </div>
  )
}