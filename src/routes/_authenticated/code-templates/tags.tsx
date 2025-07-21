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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Plus, Search, Tag, Edit, Trash2, Palette } from 'lucide-react'
import {
  CodeTemplateTag,
  CreateTagRequest,
  getAllCodeTemplateTags,
  createCodeTemplateTag,
  searchCodeTemplateTags,
  deleteCodeTemplateTag,
  updateCodeTemplateTag
} from '@/lib/tauri-api'
import { toast } from 'sonner'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'

function CodeTemplateTagsPage() {
  const [tags, setTags] = useState<CodeTemplateTag[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingTag, setEditingTag] = useState<CodeTemplateTag | null>(null)
  
  // 表单状态
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('#3b82f6')

  // 预设颜色
  const presetColors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // yellow
    '#8b5cf6', // purple
    '#06b6d4', // cyan
    '#f97316', // orange
    '#84cc16', // lime
    '#ec4899', // pink
    '#6b7280', // gray
  ]

  // 加载标签
  useEffect(() => {
    loadTags()
  }, [])

  const loadTags = async () => {
    try {
      setIsLoading(true)
      const result = await getAllCodeTemplateTags()
      setTags(result)
    } catch (error) {
      toast.error(`加载标签失败: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const searchTags = async () => {
    if (!searchQuery.trim()) {
      loadTags()
      return
    }

    try {
      setIsLoading(true)
      const result = await searchCodeTemplateTags(searchQuery)
      setTags(result)
    } catch (error) {
      toast.error(`搜索标签失败: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateTag = async () => {
    if (!tagName.trim()) {
      toast.error('请输入标签名称')
      return
    }

    try {
      const request: CreateTagRequest = {
        name: tagName.trim(),
        color: tagColor
      }

      await createCodeTemplateTag(request)
      toast.success('标签创建成功')
      
      // 重置表单
      resetForm()
      setShowCreateDialog(false)
      
      // 重新加载标签列表
      loadTags()
    } catch (error) {
      toast.error(`创建标签失败: ${error}`)
    }
  }

  const handleEditTag = async () => {
    if (!editingTag || !tagName.trim()) {
      toast.error('请输入标签名称')
      return
    }

    try {
      const request = {
        id: editingTag.id,
        name: tagName.trim(),
        color: tagColor
      }

      await updateCodeTemplateTag(request)
      toast.success('标签更新成功')
      
      // 重置表单
      resetForm()
      setShowEditDialog(false)
      setEditingTag(null)
      
      // 重新加载标签列表
      loadTags()
    } catch (error) {
      toast.error(`更新标签失败: ${error}`)
    }
  }

  const handleDeleteTag = async (tagId: number) => {
    try {
      await deleteCodeTemplateTag(tagId)
      toast.success('标签删除成功')
      loadTags()
    } catch (error) {
      console.error('删除标签失败:', error)
      toast.error(`删除标签失败: ${error}`)
    }
  }

  const resetForm = () => {
    setTagName('')
    setTagColor('#3b82f6')
  }

  const openEditDialog = (tag: CodeTemplateTag) => {
    setEditingTag(tag)
    setTagName(tag.name)
    setTagColor(tag.color || '#3b82f6')
    setShowEditDialog(true)
  }

  // 当搜索条件变化时自动搜索
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchTags()
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  return (
    <>
      <Header>
        <div className='flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>标签管理</h2>
            <p className='text-muted-foreground'>
              管理代码模板的分类标签
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
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
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tag-color">标签颜色</Label>
                  <div className="space-y-3">
                    {/* 预设颜色选择 */}
                    <div className="grid grid-cols-5 gap-2">
                      {presetColors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded border-2 transition-all ${
                            tagColor === color ? 'border-foreground scale-110' : 'border-border hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setTagColor(color)}
                        />
                      ))}
                    </div>
                    
                    {/* 自定义颜色选择器 */}
                    <div className="flex items-center gap-2">
                      <Input
                        id="tag-color"
                        type="color"
                        value={tagColor}
                        onChange={(e) => setTagColor(e.target.value)}
                        className="w-16 h-10"
                      />
                      <div 
                        className="w-10 h-10 rounded border"
                        style={{ backgroundColor: tagColor }}
                      />
                      <span className="text-sm text-muted-foreground">{tagColor}</span>
                    </div>
                  </div>
                </div>
                
                {/* 预览 */}
                <div className="space-y-2">
                  <Label>预览</Label>
                  <div className="p-3 border rounded-md bg-muted/50">
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: tagColor, color: 'white' }}
                    >
                      {tagName || '标签名称'}
                    </Badge>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setShowCreateDialog(false)
                  resetForm()
                }}>
                  取消
                </Button>
                <Button onClick={handleCreateTag}>
                  创建标签
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </Header>
      
      <Main>
        <div className="space-y-6">
          {/* 搜索区域 */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Input
                placeholder="搜索标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </div>

          {/* 标签统计 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总标签数</CardTitle>
                <Tag className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tags.length}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">最近创建</CardTitle>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {tags.length > 0 ? new Date(Math.max(...tags.map(t => new Date(t.created_at).getTime()))).toLocaleDateString() : '-'}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">颜色种类</CardTitle>
                <Palette className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Set(tags.map(t => t.color)).size}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 标签列表 */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">标签列表</h2>
            
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-4 animate-pulse" />
                加载中...
              </div>
            ) : tags.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="h-8 w-8 mx-auto mb-4" />
                {searchQuery ? "未找到匹配的标签" : "暂无标签"}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {tags.map((tag) => (
                  <Card key={tag.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              style={{ backgroundColor: tag.color || '#3b82f6', color: 'white' }}
                            >
                              {tag.name}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            创建时间: {new Date(tag.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            颜色值: {tag.color || '#3b82f6'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(tag)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTag(tag.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">颜色预览</div>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded border"
                            style={{ backgroundColor: tag.color || '#3b82f6' }}
                          />
                          <div 
                            className="w-6 h-6 rounded-full border"
                            style={{ backgroundColor: tag.color || '#3b82f6' }}
                          />
                          <Badge
                            variant="outline"
                            style={{ borderColor: tag.color || '#3b82f6', color: tag.color || '#3b82f6' }}
                          >
                            示例
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* 编辑标签对话框 */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>编辑标签</DialogTitle>
              <DialogDescription>
                修改标签的名称和颜色
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-tag-name">标签名称</Label>
                <Input
                  id="edit-tag-name"
                  placeholder="输入标签名称"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tag-color">标签颜色</Label>
                <div className="space-y-3">
                  {/* 预设颜色选择 */}
                  <div className="grid grid-cols-5 gap-2">
                    {presetColors.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded border-2 transition-all ${
                          tagColor === color ? 'border-foreground scale-110' : 'border-border hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setTagColor(color)}
                      />
                    ))}
                  </div>
                  
                  {/* 自定义颜色选择器 */}
                  <div className="flex items-center gap-2">
                    <Input
                      id="edit-tag-color"
                      type="color"
                      value={tagColor}
                      onChange={(e) => setTagColor(e.target.value)}
                      className="w-16 h-10"
                    />
                    <div 
                      className="w-10 h-10 rounded border"
                      style={{ backgroundColor: tagColor }}
                    />
                    <span className="text-sm text-muted-foreground">{tagColor}</span>
                  </div>
                </div>
              </div>
              
              {/* 预览 */}
              <div className="space-y-2">
                <Label>预览</Label>
                <div className="p-3 border rounded-md bg-muted/50">
                  <Badge
                    variant="secondary"
                    style={{ backgroundColor: tagColor, color: 'white' }}
                  >
                    {tagName || '标签名称'}
                  </Badge>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEditDialog(false)
                setEditingTag(null)
                resetForm()
              }}>
                取消
              </Button>
              <Button onClick={handleEditTag}>
                保存更改
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Main>
    </>
  )
}

export const Route = createFileRoute('/_authenticated/code-templates/tags')({ 
  component: CodeTemplateTagsPage,
})