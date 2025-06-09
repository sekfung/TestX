import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  IconDownload,
  IconUpload,
  IconDatabase,
  IconInfoCircle,
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconTrash,
  IconDeviceFloppy,
  IconFolder
} from '@tabler/icons-react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { toast } from 'sonner'
import ContentSection from '../components/content-section'

export default function DataManagement() {
  const [dataStats, setDataStats] = useState<string>('')
  const [exportPath, setExportPath] = useState<string>('~/Desktop/testx_backup.db')
  const [importPath, setImportPath] = useState<string>('')
  const [loading, setLoading] = useState(false)

  // 加载数据统计信息
  const loadDataStats = async () => {
    try {
      const stats = await invoke<string>('get_data_stats')
      setDataStats(stats)
    } catch (error) {
      console.error('获取数据统计失败:', error)
      setDataStats('获取数据统计失败')
      toast.error('获取数据统计失败')
    }
  }

  // 导出数据
  const handleExportData = async () => {
    if (!exportPath.trim()) {
      toast.error('请输入导出路径')
      return
    }

    try {
      setLoading(true)
      const result = await invoke<string>('export_data', { exportPath: exportPath.trim() })
      toast.success(result)
      setExportPath('~/Desktop/testx_backup.db') // 重置路径
    } catch (error) {
      console.error('导出数据失败:', error)
      toast.error(error instanceof Error ? error.message : '导出失败')
    } finally {
      setLoading(false)
    }
  }

  // 选择导出文件
  const handleSelectExportPath = async () => {
    try {
      const selected = await open({
        title: '选择导出位置',
        filters: [
          {
            name: 'SQLite Database',
            extensions: ['db', 'sqlite', 'sqlite3']
          }
        ],
        defaultPath: '~/Desktop/testx_backup.db'
      })
      
      if (selected) {
        setExportPath(selected as string)
      }
    } catch (error) {
      console.error('选择导出路径失败:', error)
      toast.error('选择导出路径失败')
    }
  }

  // 导入数据
  const handleImportData = async () => {
    if (!importPath.trim()) {
      toast.error('请输入导入文件路径')
      return
    }

    // 确认操作
    if (!confirm('导入数据将覆盖当前所有数据，是否继续？\n\n系统会在导入前自动创建备份。')) {
      return
    }

    try {
      setLoading(true)
      const result = await invoke<string>('import_data', { importPath: importPath.trim() })
      toast.success(result)
      setImportPath('') // 重置路径
      loadDataStats() // 刷新统计
    } catch (error) {
      console.error('导入数据失败:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`导入失败: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  // 选择导入文件
  const handleSelectImportFile = async () => {
    try {
      const selected = await open({
        title: '选择要导入的数据库文件',
        filters: [
          {
            name: 'SQLite Database',
            extensions: ['db', 'sqlite', 'sqlite3']
          }
        ],
        multiple: false
      })
      
      if (selected) {
        setImportPath(selected as string)
      }
    } catch (error) {
      console.error('选择导入文件失败:', error)
      toast.error('选择导入文件失败')
    }
  }

  // 复制路径到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('已复制到剪贴板')
  }

  useEffect(() => {
    loadDataStats()
  }, [])

  return (
    <ContentSection
      title="数据管理"
      desc="管理应用数据的备份、导入导出和统计信息"
    >
      <div className="space-y-6">
        {/* 数据统计信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <IconDatabase className="h-5 w-5" />
              <span>数据统计</span>
            </CardTitle>
            <CardDescription>
              查看当前数据库状态和统计信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={loadDataStats}
                disabled={loading}
              >
                <IconDatabase className="h-4 w-4 mr-2" />
                刷新统计
              </Button>
            </div>
            
            {dataStats && (
              <div className="rounded-md bg-muted p-4">
                <pre className="text-sm whitespace-pre-wrap">{dataStats}</pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 数据导出 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <IconDownload className="h-5 w-5" />
              <span>数据导出</span>
            </CardTitle>
            <CardDescription>
              将当前数据库导出到指定位置作为备份
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <IconInfoCircle className="h-4 w-4" />
              <AlertDescription>
                导出的数据库文件包含所有消息测试和准确性测试记录。建议定期备份重要数据。
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="export-path">导出路径</Label>
              <div className="flex space-x-2">
                <Input
                  id="export-path"
                  value={exportPath}
                  onChange={(e) => setExportPath(e.target.value)}
                  placeholder="~/Desktop/testx_backup.db"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSelectExportPath}
                  title="选择保存位置"
                >
                  <IconFolder className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(exportPath)}
                  disabled={!exportPath.trim()}
                  title="复制路径"
                >
                  <IconCopy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                支持 ~ 表示用户主目录，例如: ~/Desktop/backup.db，或点击文件夹图标选择位置
              </p>
            </div>

            <Button
              onClick={handleExportData}
              disabled={loading || !exportPath.trim()}
              className="w-full"
            >
              <IconDownload className="h-4 w-4 mr-2" />
              {loading ? '导出中...' : '导出数据'}
            </Button>
          </CardContent>
        </Card>

        {/* 数据导入 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <IconUpload className="h-5 w-5" />
              <span>数据导入</span>
            </CardTitle>
            <CardDescription>
              从备份文件恢复数据
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-orange-200 bg-orange-50">
              <IconAlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <div className="font-medium mb-1">⚠️ 注意</div>
                <div className="text-sm space-y-1">
                  <div>• 导入操作将完全替换当前所有数据</div>
                  <div>• 系统会在导入前自动创建当前数据的备份</div>
                  <div>• 请确保导入文件是有效的TestX数据库备份</div>
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="import-path">导入文件路径</Label>
              <div className="flex space-x-2">
                <Input
                  id="import-path"
                  value={importPath}
                  onChange={(e) => setImportPath(e.target.value)}
                  placeholder="~/Desktop/testx_backup.db"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleSelectImportFile}
                  title="选择文件"
                >
                  <IconFolder className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(importPath)}
                  disabled={!importPath.trim()}
                  title="复制路径"
                >
                  <IconCopy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                支持 ~ 表示用户主目录，例如: ~/Desktop/backup.db，或点击文件夹图标选择文件
              </p>
            </div>

            <Button
              onClick={handleImportData}
              disabled={loading || !importPath.trim()}
              variant="destructive"
              className="w-full"
            >
              <IconUpload className="h-4 w-4 mr-2" />
              {loading ? '导入中...' : '导入数据'}
            </Button>
          </CardContent>
        </Card>

        {/* 自动备份信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <IconDeviceFloppy className="h-5 w-5" />
              <span>自动备份</span>
            </CardTitle>
            <CardDescription>
              应用启动时的自动备份机制
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <IconCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm">应用启动时自动创建数据库备份</span>
              </div>
              <div className="flex items-center space-x-2">
                <IconCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm">自动保留最近5个备份文件</span>
              </div>
              <div className="flex items-center space-x-2">
                <IconCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm">自动清理过期备份节省存储空间</span>
              </div>
              <div className="flex items-center space-x-2">
                <IconCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm">数据存储在用户数据目录，升级不丢失</span>
              </div>
            </div>

            <Alert>
              <IconInfoCircle className="h-4 w-4" />
              <AlertDescription>
                自动备份文件位于应用数据目录的 backups 文件夹中，格式为：
                <code className="mx-1 px-1 rounded bg-muted">testx_backup_YYYYMMDD_HHMMSS.db</code>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </ContentSection>
  )
} 