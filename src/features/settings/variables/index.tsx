import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconPlus, IconEdit, IconTrash, IconVariable, IconRefresh } from '@tabler/icons-react'
import { toast } from 'sonner'
import { invoke } from '@tauri-apps/api/core'

interface Variable {
  id: number
  name: string
  value: string
  description?: string
  is_default: boolean
  created_at: string
  updated_at: string
}

interface VariableFormData {
  name: string
  value: string
  description: string
}

export default function Variables() {
  const [variables, setVariables] = useState<Variable[]>([])
  const [loading, setLoading] = useState(false)
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [formData, setFormData] = useState<VariableFormData>({
    name: '',
    value: '',
    description: ''
  })

  // 加载变量列表
  const loadVariables = async () => {
    try {
      setLoading(true)
      const result = await invoke<Variable[]>('get_all_variables')
      setVariables(result)
    } catch (error) {
      console.error('加载变量失败:', error)
      toast.error('加载变量失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVariables()
  }, [])

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      value: '',
      description: ''
    })
    setEditingVariable(null)
  }

  // 打开新增对话框
  const handleAdd = () => {
    resetForm()
    setShowDialog(true)
  }

  // 打开编辑对话框
  const handleEdit = (variable: Variable) => {
    if (variable.is_default) {
      // 默认变量只能编辑值和描述
      setFormData({
        name: variable.name,
        value: variable.value,
        description: variable.description || ''
      })
    } else {
      setFormData({
        name: variable.name,
        value: variable.value,
        description: variable.description || ''
      })
    }
    setEditingVariable(variable)
    setShowDialog(true)
  }

  // 保存变量
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('变量名不能为空')
      return
    }

    // 验证变量名格式（只允许字母、数字、下划线）
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(formData.name)) {
      toast.error('变量名只能包含字母、数字和下划线，且不能以数字开头')
      return
    }

    try {
      setLoading(true)
      
      if (editingVariable) {
        // 更新变量
        await invoke('update_variable', {
          id: editingVariable.id,
          name: formData.name,
          value: formData.value,
          description: formData.description || null
        })
        toast.success('变量更新成功')
      } else {
        // 创建变量
        await invoke('create_variable', {
          name: formData.name,
          value: formData.value,
          description: formData.description || null
        })
        toast.success('变量创建成功')
      }

      setShowDialog(false)
      resetForm()
      await loadVariables()
    } catch (error) {
      console.error('保存变量失败:', error)
      toast.error(`保存变量失败: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  // 删除变量
  const handleDelete = async (variable: Variable) => {
    if (variable.is_default) {
      toast.error('默认变量不能删除')
      return
    }

    try {
      setLoading(true)
      await invoke('delete_variable', { id: variable.id })
      toast.success('变量删除成功')
      await loadVariables()
    } catch (error) {
      console.error('删除变量失败:', error)
      toast.error(`删除变量失败: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">变量管理</h3>
        <p className="text-sm text-muted-foreground">
          管理Python代码中使用的变量。在代码中使用 ${'{'}variable_name{'}'} 格式引用变量，执行时会自动替换为对应的值。
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconVariable className="h-5 w-5" />
                变量列表
              </CardTitle>
              <CardDescription>
                默认变量不能删除，只能修改值。自定义变量支持完整的增删改操作。
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadVariables}
              >
                <IconRefresh className="h-4 w-4 mr-2" />
                刷新
              </Button>
              <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogTrigger asChild>
                  <Button onClick={handleAdd}>
                    <IconPlus className="h-4 w-4 mr-2" />
                    新增变量
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingVariable ? '编辑变量' : '新增变量'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingVariable?.is_default 
                        ? '编辑默认变量的值和描述（变量名不可修改）'
                        : '创建或编辑自定义变量'
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name">变量名</Label>
                      <Input
                        id="name"
                        placeholder="例：PRODUCT_KEY"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                        disabled={editingVariable?.is_default}
                      />
                      <p className="text-xs text-muted-foreground">
                        只能包含字母、数字和下划线，不能以数字开头
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="value">变量值</Label>
                      <Input
                        id="value"
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description">描述（可选）</Label>
                      <Textarea
                        id="description"
                        placeholder="变量的用途说明"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDialog(false)}>
                      取消
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                      保存
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {variables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无变量，点击"新增变量"开始创建
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>变量名</TableHead>
                  <TableHead>变量值</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variables.map((variable) => (
                  <TableRow key={variable.id}>
                    <TableCell className="font-mono font-medium">
                      {variable.name}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="truncate" title={variable.value}>
                        {variable.value || <span className="text-muted-foreground italic">空</span>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <div className="truncate" title={variable.description}>
                        {variable.description || <span className="text-muted-foreground italic">无描述</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={variable.is_default ? "default" : "secondary"}>
                        {variable.is_default ? '默认' : '自定义'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(variable.updated_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(variable)}
                        >
                          <IconEdit className="h-3 w-3" />
                        </Button>
                        {!variable.is_default && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <IconTrash className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>确认删除</AlertDialogTitle>
                                <AlertDialogDescription>
                                  确定要删除变量 "{variable.name}" 吗？此操作不可撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(variable)}>
                                  删除
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">在Python代码中使用变量</h4>
            <div className="bg-muted p-3 rounded-md font-mono text-sm">
              <div># 使用变量的格式：${'{变量名}'}</div>
              <div>product_key = ${'{'}PRODUCT_KEY{'}'}</div>
              <div>device_name = ${'{'}DEVICE_NAME{'}'}</div>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">变量命名规则</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 只能包含字母、数字和下划线</li>
              <li>• 不能以数字开头</li>
              <li>• 建议使用大写字母和下划线（如：PRODUCT_KEY）</li>
              <li>• 变量名不区分大小写</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">默认变量</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• PRODUCT_KEY：阿里云IoT产品密钥</li>
              <li>• DEVICE_NAME：设备名称</li>
              <li>• 默认变量不能删除，只能修改值</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 