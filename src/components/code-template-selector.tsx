"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { BookOpen, Check, ChevronsUpDown, Plus, RotateCcw, Save, Search, Tag, X } from "lucide-react"
import { cn } from "@/lib/utils"
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
  searchCodeTemplateTags
} from "@/lib/tauri-api"
import { toast } from "sonner"

interface CodeTemplateSelectorProps {
  onTemplateSelect: (code: string) => void
  currentCode: string
  language?: string
}

export function CodeTemplateSelector({ onTemplateSelect, currentCode, language = "python" }: CodeTemplateSelectorProps) {
  const [templates, setTemplates] = useState<CodeTemplateWithTags[]>([])
  const [allTags, setAllTags] = useState<CodeTemplateTag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showTagDialog, setShowTagDialog] = useState(false)
  const [tagComboOpen, setTagComboOpen] = useState(false)
  
  // 新建标签表单状态
  const [newTagName, setNewTagName] = useState("")
  const [newTagColor, setNewTagColor] = useState("#3b82f6")

  // 加载模板和标签
  useEffect(() => {
    loadTemplates()
    loadTags()
  }, [])

  const loadTemplates = async () => {
    try {
      setIsLoading(true)
      const result = await getCodeTemplates(language)
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
        language,
        tag_names: selectedTags
      })
      setTemplates(result)
    } catch (error) {
      toast.error(`搜索代码模板失败: ${error}`)
    } finally {
      setIsLoading(false)
    }
  }



  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error("请输入标签名称")
      return
    }

    try {
      const request: CreateTagRequest = {
        name: newTagName.trim(),
        color: newTagColor
      }

      await createCodeTemplateTag(request)
      toast.success("标签创建成功")
      
      // 重置表单
      setNewTagName("")
      setNewTagColor("#3b82f6")
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
    <div className="space-y-3">
      {/* 紧凑的搜索和操作区域 */}
      <div className="flex gap-2 items-center">
        <div className="flex-1">
          <Input
            placeholder="搜索代码模板..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>
        
        {/* 标签筛选 */}
        <Popover open={tagComboOpen} onOpenChange={setTagComboOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
            >
              <Tag className="h-3 w-3 mr-1" />
              {selectedTags.length > 0 ? selectedTags.length : "标签"}
              <ChevronsUpDown className="ml-1 h-3 w-3" />
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
          className="h-8 px-2"
          onClick={() => {
            setSearchQuery('')
            setSelectedTags([])
          }}
          disabled={!searchQuery && selectedTags.length === 0}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          <span className="text-xs">重置</span>
        </Button>
      </div>



      {/* 已选择的标签显示 - 更紧凑 */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tagName) => {
            const tag = allTags.find(t => t.name === tagName)
            return (
              <Badge
                key={tagName}
                variant="secondary"
                style={{ backgroundColor: tag?.color || '#3b82f6', color: 'white' }}
                className="cursor-pointer text-xs h-5"
                onClick={() => handleTagToggle(tagName)}
              >
                {tagName}
                <X className="ml-1 h-2 w-2" />
              </Badge>
            )
          })}
        </div>
      )}

      {/* 模板列表 - 更紧凑的卡片设计 */}
      <ScrollArea className="h-[350px]">
        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <BookOpen className="h-4 w-4 mx-auto mb-2 animate-pulse" />
              加载中...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <BookOpen className="h-4 w-4 mx-auto mb-2" />
              {searchQuery || selectedTags.length > 0 ? "未找到匹配的模板" : "暂无代码模板"}
            </div>
          ) : (
            templates.map((templateWithTags) => {
              // Add null check to prevent undefined access
              if (!templateWithTags || !templateWithTags.template) {
                return null;
              }
              
              return (
                <Card 
                  key={templateWithTags.template.id} 
                  className="cursor-pointer hover:bg-accent transition-colors border-l-2"
                  style={{ borderLeftColor: templateWithTags.tags?.[0]?.color || '#e5e7eb' }}
                  onClick={() => onTemplateSelect(templateWithTags.template.code_content)}
                >
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-sm font-medium leading-tight">
                          {templateWithTags.template.name}
                        </CardTitle>
                        {templateWithTags.template.description && (
                          <CardDescription className="text-xs leading-tight">
                            {templateWithTags.template.description}
                          </CardDescription>
                        )}
                      </div>
                      {templateWithTags.tags && templateWithTags.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 ml-2">
                          {templateWithTags.tags.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="secondary"
                              className="text-xs h-4 px-1"
                              style={{ backgroundColor: tag.color || '#3b82f6', color: 'white' }}
                            >
                              {tag.name}
                            </Badge>
                          ))}
                          {templateWithTags.tags.length > 2 && (
                            <Badge variant="secondary" className="text-xs h-4 px-1">
                              +{templateWithTags.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 pb-3">
                    <pre className="text-xs bg-muted/50 p-2 rounded text-ellipsis whitespace-pre-wrap max-h-16 overflow-hidden leading-tight">
                      {templateWithTags.template.code_content.length > 150 
                        ? templateWithTags.template.code_content.substring(0, 150) + '...' 
                        : templateWithTags.template.code_content
                      }
                    </pre>
                    <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                      <span>{templateWithTags.template.language}</span>
                      <span>{new Date(templateWithTags.template.updated_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            }).filter(Boolean)
          )}
        </div>
      </ScrollArea>
    </div>
  )
}