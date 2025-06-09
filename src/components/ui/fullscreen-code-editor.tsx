import { useRef, useState, useEffect } from 'react'
import { Editor } from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { IconMaximize, IconSettings, IconX, IconPalette, IconTypography, IconMinus, IconMaximizeOff } from '@tabler/icons-react'

interface FullscreenCodeEditorProps {
  isOpen: boolean
  onClose: () => void
  code: string
  onCodeChange: (code: string) => void
  title?: string
  language?: string
  theme?: string
  height?: string
}

export function FullscreenCodeEditor({
  isOpen,
  onClose,
  code,
  onCodeChange,
  title = "代码编辑器",
  language = "python",
  theme = "vs-dark",
  height = "calc(100vh - 200px)"
}: FullscreenCodeEditorProps) {
  const editorRef = useRef<any>(null)
  const [localCode, setLocalCode] = useState(code)
  const [currentTheme, setCurrentTheme] = useState(theme)
  const [fontSize, setFontSize] = useState(16)
  const [showSettings, setShowSettings] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

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

  // 同步外部代码变化
  useEffect(() => {
    setLocalCode(code)
  }, [code])

  // 同步外部主题变化
  useEffect(() => {
    setCurrentTheme(theme)
  }, [theme])

  const handleCodeChange = (value: string | undefined) => {
    const newCode = value || ''
    setLocalCode(newCode)
  }

  const handleSave = () => {
    onCodeChange(localCode)
    onClose()
  }

  const handleCancel = () => {
    setLocalCode(code) // 恢复原始代码
    onClose()
  }

  const handleThemeChange = (newTheme: string) => {
    setCurrentTheme(newTheme)
  }

  const handleFontSizeChange = (newSize: string) => {
    const size = parseInt(newSize)
    setFontSize(size)
    // 实时更新编辑器字体大小
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize: size })
    }
  }

  const setupPythonIntelliSense = (monaco: any) => {
    // 注册Python代码补全提供者
    monaco.languages.registerCompletionItemProvider('python', {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        }

        const suggestions = [
          // Python内置函数
          {
            label: 'def',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'def ${1:function_name}(${2:parameters}):\n    ${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '定义函数',
            range: range
          },
          {
            label: 'import',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'import ${1:module}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '导入模块',
            range: range
          },
          {
            label: 'from',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'from ${1:module} import ${2:item}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '从模块导入',
            range: range
          },
          {
            label: 'if',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'if ${1:condition}:\n    ${2:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'if条件语句',
            range: range
          },
          {
            label: 'for',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'for ${1:item} in ${2:iterable}:\n    ${3:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'for循环',
            range: range
          },
          {
            label: 'try',
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: 'try:\n    ${1:pass}\nexcept ${2:Exception} as ${3:e}:\n    ${4:pass}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '异常处理',
            range: range
          },
          // Python常用函数
          {
            label: 'print',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'print(${1:value})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '打印输出',
            range: range
          },
          {
            label: 'len',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'len(${1:object})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '获取对象长度',
            range: range
          },
          {
            label: 'str',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'str(${1:object})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '转换为字符串',
            range: range
          },
          {
            label: 'int',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'int(${1:value})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '转换为整数',
            range: range
          },
          {
            label: 'float',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'float(${1:value})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '转换为浮点数',
            range: range
          },
          // JSON操作
          {
            label: 'json.dumps',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'json.dumps(${1:obj}, ${2:ensure_ascii=False})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '将Python对象转换为JSON字符串',
            range: range
          },
          {
            label: 'json.loads',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'json.loads(${1:json_string})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '将JSON字符串转换为Python对象',
            range: range
          },
          // 时间相关
          {
            label: 'datetime.now',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'datetime.now()',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '获取当前时间',
            range: range
          },
          {
            label: 'time.time',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'time.time()',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '获取当前时间戳',
            range: range
          },
          // 随机数
          {
            label: 'random.randint',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'random.randint(${1:a}, ${2:b})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '生成指定范围内的随机整数',
            range: range
          },
          {
            label: 'random.choice',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'random.choice(${1:sequence})',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '从序列中随机选择一个元素',
            range: range
          },
          // IoT相关模板
          {
            label: 'generate_message',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'def generate_message():\n    """\n    生成IoT消息的函数\n    必须返回包含topic, qos_level, payload, product_key, device_name的字典\n    """\n    return {\n        "topic": "${1:/your/topic/here}",\n        "qos_level": ${2:1},\n        "payload": json.dumps({\n            ${3:"key": "value"}\n        }, ensure_ascii=False),\n        "product_key": "${4:your_product_key}",\n        "device_name": "${5:your_device_name}"\n    }',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'IoT消息生成函数模板',
            range: range
          },
          {
            label: 'generate_expected_text',
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: 'def generate_expected_text():\n    """\n    生成期望播报文本的函数\n    返回字符串类型的期望文本\n    """\n    return "${1:期望的播报文本}"',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: '期望文本生成函数模板',
            range: range
          },
          // 常用字典结构
          {
            label: 'iot_message_dict',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: '{\n    "topic": "${1:/topic}",\n    "qos_level": ${2:1},\n    "payload": "${3:payload}",\n    "product_key": "${4:product_key}",\n    "device_name": "${5:device_name}"\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'IoT消息字典结构',
            range: range
          }
        ]

        return { suggestions: suggestions }
      }
    })

    // 注册悬停提示提供者
    monaco.languages.registerHoverProvider('python', {
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position)
        if (!word) return null

        const hoverInfo: any = {
          'generate_message': {
            contents: [
              { value: '**generate_message()**' },
              { value: 'IoT消息生成函数，必须返回包含以下字段的字典：' },
              { value: '- `topic`: 消息主题 (string)' },
              { value: '- `qos_level`: QoS等级 (0, 1, 2)' },
              { value: '- `payload`: 消息内容 (JSON string)' },
              { value: '- `product_key`: 产品密钥 (string)' },
              { value: '- `device_name`: 设备名称 (string)' }
            ]
          },
          'generate_expected_text': {
            contents: [
              { value: '**generate_expected_text()**' },
              { value: '期望文本生成函数，用于准确性测试' },
              { value: '必须返回字符串类型的期望播报文本' }
            ]
          },
          'json.dumps': {
            contents: [
              { value: '**json.dumps(obj, ensure_ascii=False)**' },
              { value: '将Python对象序列化为JSON字符串' },
              { value: '建议设置 ensure_ascii=False 支持中文字符' }
            ]
          }
        }

        const info = hoverInfo[word.word]
        if (info) {
          return {
            range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
            contents: info.contents
          }
        }
        return null
      }
    })
  }

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor
    
    // 设置编辑器选项
    editor.updateOptions({
      fontSize: fontSize,
      lineNumbers: 'on',
      rulers: [80, 120],
      wordWrap: 'on',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 4,
      insertSpaces: true,
      detectIndentation: false,
      folding: true,
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
      glyphMargin: false,
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
      // 启用代码折叠和语法高亮
      foldingHighlight: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      foldingImportsByDefault: false,
      // 启用语法高亮
      semanticHighlighting: {
        enabled: true
      }
    })

    // 设置Python智能感知
    setupPythonIntelliSense(monaco)

    // 正确设置快捷键 - 使用monaco对象
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave()
    })
    
    editor.addCommand(monaco.KeyCode.Escape, () => {
      handleCancel()
    })

    // 设置快捷键提示
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Space, () => {
      editor.trigger('', 'editor.action.triggerSuggest', {})
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent 
        className="max-w-none w-full h-full flex flex-col p-0 m-0"
        style={{
          width: '98vw',
          height: '98vh',
          maxWidth: '98vw',
          maxHeight: '98vh',
        }}
      >
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center space-x-2">
              <IconMaximize className="h-5 w-5" />
              <span>{title}</span>
            </DialogTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-orange-600 hover:text-orange-700"
                title={isMinimized ? "展开编辑器" : "最小化编辑器"}
              >
                {isMinimized ? <IconMaximizeOff className="h-4 w-4" /> : <IconMinus className="h-4 w-4" />}
                {isMinimized ? "展开" : "最小化"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="text-blue-600 hover:text-blue-700"
              >
                <IconSettings className="h-4 w-4 mr-1" />
                设置
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                className="text-green-600 hover:text-green-700"
              >
                保存 (Ctrl+S)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
              >
                <IconX className="h-4 w-4" />
                取消
              </Button>
            </div>
          </div>
          
          {/* 设置面板 */}
          {showSettings && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center space-x-2">
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
                  <Label className="flex items-center space-x-2">
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
            </div>
          )}
        </DialogHeader>
        
        {!isMinimized && (
          <>
            <div className="flex-1 min-h-0 overflow-hidden">
              <Editor
                height="100%"
                defaultLanguage={language}
                value={localCode}
                onChange={handleCodeChange}
                onMount={handleEditorDidMount}
                theme={currentTheme}
                options={{
                  fontSize: fontSize,
                  lineNumbers: 'on',
                  rulers: [80, 120],
                  wordWrap: 'on',
                  minimap: { enabled: true },
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
            
            <div className="px-6 py-4 border-t bg-muted/30 shrink-0">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  提示: 使用 Ctrl+S 保存，Esc 取消 | 点击设置按钮自定义主题和字体
                </div>
                <div>
                  行数: {localCode.split('\n').length} | 字符数: {localCode.length} | 字体: {fontSize}px | 主题: {themeOptions.find(t => t.value === currentTheme)?.label}
                </div>
              </div>
            </div>
          </>
        )}
        
        {isMinimized && (
          <div className="px-6 py-4 border-t bg-muted/30 shrink-0">
            <div className="flex items-center justify-center text-sm text-muted-foreground">
              <div className="text-center">
                <p>编辑器已最小化</p>
                <p className="text-xs mt-1">点击"展开"按钮恢复编辑器视图</p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}