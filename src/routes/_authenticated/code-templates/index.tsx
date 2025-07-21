import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { BookOpen, Check, ChevronsUpDown, Plus, RotateCcw, Save, Search, Tag, X, Edit, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CodeTemplateWithTags,
  CodeTemplateTag,
  CreateTemplateRequest,
  CreateTagRequest,
  getCodeTemplates,
  searchCodeTemplates,
  saveCodeTemplate,
  getAllCodeTemplateTags,
  createCodeTemplateTag,
  searchCodeTemplateTags,
  deleteCodeTemplate,
  updateCodeTemplate
} from '@/lib/tauri-api'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'

function CodeTemplatesPage() {
  const [templates, setTemplates] = useState<CodeTemplateWithTags[]>([])
  const [allTags, setAllTags] = useState<CodeTemplateTag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [tagComboOpen, setTagComboOpen] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [editingTemplate, setEditingTemplate] = useState<CodeTemplateWithTags | null>(null)
  
  // 表单状态
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateCode, setTemplateCode] = useState('')
  const [templateLanguage, setTemplateLanguage] = useState('python')
  
  // 新建标签表单状态
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')

  // 加载模板和标签
  useEffect(() => {
    loadTemplates()
    loadTags()
  }, [])

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      const result = await getCodeTemplates()
      setTemplates(result)
    } catch (error) {
      toast.error(`加载代码模板失败: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const loadTags = async () => {
    try {
      const result = await getAllCodeTemplateTags()
      setAllTags(result)
    } catch (error) {
      toast.error(`加载标签失败: ${error}`)
    }
  }

  const searchTemplates = async () => {
    try {
      setIsLoading(true)
      const result = await searchCodeTemplates({
        query: searchQuery || undefined,
        tag_names: selectedTags
      })
      setTemplates(result)
    } catch (error) {
      toast.error(`搜索代码模板失败: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      toast.error('请输入模板名称')
      return
    }

    if (!templateCode.trim()) {
      toast.error('请输入模板代码')
      return
    }

    try {
      const request: CreateTemplateRequest = {
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        code_content: templateCode,
        language: templateLanguage,
        tag_ids: selectedTagIds
      }

      await saveCodeTemplate(request)
      toast.success('代码模板创建成功')
      
      // 重置表单
      resetForm()
      setShowCreateDialog(false)
      
      // 重新加载模板列表
      loadTemplates()
    } catch (error) {
      toast.error(`创建代码模板失败: ${error}`)
    }
  }

  const handleEditTemplate = async () => {
    if (!editingTemplate || !templateName.trim()) {
      toast.error('请输入模板名称')
      return
    }

    if (!templateCode.trim()) {
      toast.error('请输入模板代码')
      return
    }

    try {
      const request = {
        id: editingTemplate.template.id,
        name: templateName.trim(),
        description: templateDescription.trim() || undefined,
        code_content: templateCode,
        language: templateLanguage,
        tag_ids: selectedTagIds
      }

      await updateCodeTemplate(request)
      toast.success('代码模板更新成功')
      
      // 重置表单
      resetForm()
      setShowEditDialog(false)
      setEditingTemplate(null)
      
      // 重新加载模板列表
      loadTemplates()
    } catch (error) {
      toast.error(`更新代码模板失败: ${error}`)
    }
  }

  const handleDeleteTemplate = async (templateId: number) => {
    try {
      await deleteCodeTemplate(templateId)
      toast.success('代码模板删除成功')
      loadTemplates()
    } catch (error) {
      console.error('删除代码模板失败:', error)
      toast.error(`删除代码模板失败: ${error}`)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('请输入标签名称')
      return
    }

    try {
      const request: CreateTagRequest = {
        name: newTagName.trim(),
        color: newTagColor
      }

      await createCodeTemplateTag(request)
      toast.success('标签创建成功')
      
      // 重置表单
      setNewTagName('')
      setNewTagColor('#3b82f6')
      setShowTagDialog(false)
      
      // 重新加载标签列表
      loadTags()
    } catch (error) {
      toast.error(`创建标签失败: ${error}`)
    }
  }

  const handleTagToggle = (tagName: string) => {
    setSelectedTags(prev => 
      prev.includes(tagName) 
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    )
  }

  const handleTagIdToggle = (tagId: number) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const resetForm = () => {
    setTemplateName('')
    setTemplateDescription('')
    setTemplateCode('')
    setTemplateLanguage('python')
    setSelectedTagIds([])
  }

  const openEditDialog = (template: CodeTemplateWithTags) => {
    setEditingTemplate(template)
    setTemplateName(template.template.name)
    setTemplateDescription(template.template.description || '')
    setTemplateCode(template.template.code_content)
    setTemplateLanguage(template.template.language)
    setSelectedTagIds(template.tags.map(tag => tag.id))
    setShowEditDialog(true)
  }

  // 当搜索条件变化时自动搜索
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery || selectedTags.length > 0) {
        searchTemplates()
      } else {
        loadTemplates()
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, selectedTags])

  return (
    <>
      <Header>
        <div className='flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>代码模板</h2>
            <p className='text-muted-foreground'>
              管理和使用代码模板，提高开发效率
            </p>
          </div>
          <div className='flex space-x-2'>
            <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Tag className="h-4 w-4 mr-2" />
                  新建标签
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>创建新标签</DialogTitle>
                  <DialogDescription>
                    为代码模板创建一个新的分类标签
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tag-name">标签名称</Label>
                    <Input
                      id="tag-name"
                      placeholder="输入标签名称"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tag-color">标签颜色</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="tag-color"
                        type="color"
                        value={newTagColor}
                        onChange={(e) => setNewTagColor(e.target.value)}
                        className="w-16 h-10"
                      />
                      <div 
                        className="w-10 h-10 rounded border"
                        style={{ backgroundColor: newTagColor }}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowTagDialog(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreateTag}>
                    创建标签
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新建模板
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>创建代码模板</DialogTitle>
                  <DialogDescription>
                    创建一个新的代码模板以便重复使用
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="template-name">模板名称</Label>
                      <Input
                        id="template-name"
                        placeholder="输入模板名称"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-language">编程语言</Label>
                      <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择编程语言" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="python">Python</SelectItem>
                          <SelectItem value="javascript">JavaScript</SelectItem>
                          <SelectItem value="typescript">TypeScript</SelectItem>
                          <SelectItem value="java">Java</SelectItem>
                          <SelectItem value="cpp">C++</SelectItem>
                          <SelectItem value="c">C</SelectItem>
                          <SelectItem value="rust">Rust</SelectItem>
                          <SelectItem value="go">Go</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="template-description">模板描述</Label>
                    <Input
                      id="template-description"
                      placeholder="输入模板描述（可选）"
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>选择标签</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowTagDialog(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        新建标签
                      </Button>
                      
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="justify-between"
                          >
                            {selectedTagIds.length > 0 ? `已选择 ${selectedTagIds.length} 个标签` : "选择标签"}
                            <ChevronsUpDown className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0">
                          <Command>
                            <CommandInput placeholder="搜索标签..." />
                            <CommandList>
                              <CommandEmpty>未找到标签</CommandEmpty>
                              <CommandGroup>
                                {allTags.map((tag) => (
                                  <CommandItem
                                    key={tag.id}
                                    onSelect={() => handleTagIdToggle(tag.id)}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedTagIds.includes(tag.id) ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <Badge 
                                      variant="secondary" 
                                      className="text-xs"
                                      style={{ backgroundColor: tag.color || '#3b82f6', color: 'white' }}
                                    >
                                      {tag.name}
                                    </Badge>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    {/* 已选择的标签显示 */}
                    {selectedTagIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedTagIds.map((tagId) => {
                          const tag = allTags.find(t => t.id === tagId)
                          if (!tag) return null
                          return (
                            <Badge
                              key={tagId}
                              variant="secondary"
                              style={{ backgroundColor: tag.color || '#3b82f6', color: 'white' }}
                              className="cursor-pointer text-xs h-5"
                              onClick={() => handleTagIdToggle(tagId)}
                            >
                              {tag.name}
                              <X className="ml-1 h-2 w-2" />
                            </Badge>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="template-code">模板代码</Label>
                    <Textarea
                      id="template-code"
                      placeholder="输入模板代码"
                      value={templateCode}
                      onChange={(e) => setTemplateCode(e.target.value)}
                      className="min-h-[200px] font-mono"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => {
                    setShowCreateDialog(false)
                    resetForm()
                  }}>
                    取消
                  </Button>
                  <Button onClick={handleCreateTemplate}>
                    创建模板
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </Header>
      
      <Main>
        <div className="space-y-6">
          {/* 搜索和筛选区域 */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="搜索代码模板..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            
            {/* 标签筛选 */}
            <Popover open={tagComboOpen} onOpenChange={setTagComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-between"
                >
                  <Tag className="h-4 w-4 mr-2" />
                  {selectedTags.length > 0 ? `${selectedTags.length} 个标签` : "筛选标签"}
                  <ChevronsUpDown className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="搜索标签..." />
                  <CommandList>
                    <CommandEmpty>未找到标签</CommandEmpty>
                    <CommandGroup>
                      {allTags.map((tag) => (
                        <CommandItem
                          key={tag.id}
                          onSelect={() => handleTagToggle(tag.name)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedTags.includes(tag.name) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <Badge 
                            variant="secondary" 
                            className="text-xs"
                            style={{ backgroundColor: tag.color || '#3b82f6', color: 'white' }}
                          >
                            {tag.name}
                          </Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            {/* 重置按钮 */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setSearchQuery('')
                setSelectedTags([])
              }}
              disabled={!searchQuery && selectedTags.length === 0}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              重置
            </Button>
          </div>

          {/* 已选择的标签显示 */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tagName) => {
                const tag = allTags.find(t => t.name === tagName)
                return (
                  <Badge
                    key={tagName}
                    variant="secondary"
                    style={{ backgroundColor: tag?.color || '#3b82f6', color: 'white' }}
                    className="cursor-pointer"
                    onClick={() => handleTagToggle(tagName)}
                  >
                    {tagName}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                )
              })}
            </div>
          )}

          {/* 模板列表 */}
          <div className="grid gap-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-4 animate-pulse" />
                加载中...
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-4" />
                {searchQuery || selectedTags.length > 0 ? "未找到匹配的模板" : "暂无代码模板"}
              </div>
            ) : (
              templates.map((templateWithTags) => {
                if (!templateWithTags || !templateWithTags.template) {
                  return null
                }
                
                return (
                  <Card key={templateWithTags.template.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-lg font-medium">
                            {templateWithTags.template.name}
                          </CardTitle>
                          {templateWithTags.template.description && (
                            <CardDescription>
                              {templateWithTags.template.description}
                            </CardDescription>
                          )}
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {templateWithTags.template.language}
                            </Badge>
                            <span>•</span>
                            <span>
                              {new Date(templateWithTags.template.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(templateWithTags)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTemplate(templateWithTags.template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* 标签显示 */}
                      {templateWithTags.tags && templateWithTags.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {templateWithTags.tags.map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="secondary"
                              style={{ backgroundColor: tag.color || '#3b82f6', color: 'white' }}
                              className="text-xs h-5"
                            >
                              {tag.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="bg-muted/50 rounded-md p-3">
                        <pre className="text-sm font-mono whitespace-pre-wrap overflow-x-auto max-h-32 overflow-y-auto">
                          {templateWithTags.template.code_content}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </div>
        
        {/* 编辑模板对话框 */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>编辑代码模板</DialogTitle>
              <DialogDescription>
                修改代码模板的信息和内容
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-template-name">模板名称</Label>
                  <Input
                    id="edit-template-name"
                    placeholder="输入模板名称"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-template-language">编程语言</Label>
                  <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择编程语言" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="typescript">TypeScript</SelectItem>
                      <SelectItem value="java">Java</SelectItem>
                      <SelectItem value="cpp">C++</SelectItem>
                      <SelectItem value="c">C</SelectItem>
                      <SelectItem value="rust">Rust</SelectItem>
                      <SelectItem value="go">Go</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-template-description">模板描述</Label>
                <Input
                  id="edit-template-description"
                  placeholder="输入模板描述（可选）"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>选择标签</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="justify-between"
                    >
                      {selectedTagIds.length > 0 ? `已选择 ${selectedTagIds.length} 个标签` : "选择标签"}
                      <ChevronsUpDown className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="搜索标签..." />
                      <CommandList>
                        <CommandEmpty>未找到标签</CommandEmpty>
                        <CommandGroup>
                          {allTags.map((tag) => (
                            <CommandItem
                              key={tag.id}
                              onSelect={() => handleTagIdToggle(tag.id)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedTagIds.includes(tag.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <Badge 
                                variant="secondary" 
                                className="text-xs"
                                style={{ backgroundColor: tag.color || '#3b82f6', color: 'white' }}
                              >
                                {tag.name}
                              </Badge>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                
                {/* 已选择的标签显示 */}
                {selectedTagIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedTagIds.map((tagId) => {
                      const tag = allTags.find(t => t.id === tagId)
                      if (!tag) return null
                      return (
                        <Badge
                          key={tagId}
                          variant="secondary"
                          style={{ backgroundColor: tag.color || '#3b82f6', color: 'white' }}
                          className="cursor-pointer text-xs h-5"
                          onClick={() => handleTagIdToggle(tagId)}
                        >
                          {tag.name}
                          <X className="ml-1 h-2 w-2" />
                        </Badge>
                      )
                    })}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-template-code">模板代码</Label>
                <Textarea
                  id="edit-template-code"
                  placeholder="输入模板代码"
                  value={templateCode}
                  onChange={(e) => setTemplateCode(e.target.value)}
                  className="min-h-[200px] font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEditDialog(false)
                setEditingTemplate(null)
                resetForm()
              }}>
                取消
              </Button>
              <Button onClick={handleEditTemplate}>
                保存更改
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/code-templates/')({ 
  component: CodeTemplatesPage,
})