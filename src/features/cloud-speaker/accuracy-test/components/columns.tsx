import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { CustomModal } from '@/components/ui/custom-modal'
import { TextDiff } from '@/components/ui/text-diff'
import { DataTableColumnHeader } from './data-table-column-header'
import { ResultCell } from './result-cell'
import { DataTableRowActions } from './data-table-row-actions'
import { useState } from 'react'
import { toast } from 'sonner'
import { 
  IconCheck, 
  IconX, 
  IconClock, 
  IconCode, 
  IconFileText,
  IconTrash,
  IconEye,
  IconPlayerPlay,
  IconPlayerPause
} from '@tabler/icons-react'

interface AccuracyTest {
  id: string
  expected_text: string
  recognized_text?: string
  similarity?: number
  result: 'pending' | 'passed' | 'failed'
  created_at: string
  completed_at?: string
  audio_file_path?: string
  python_code?: string
  mode: 'form' | 'code'
  error_message?: string
  notes?: string
  audio_data?: string // Base64编码的音频数据
  audio_duration?: number // 音频时长（毫秒）
}

const resultIcons = {
  passed: IconCheck,
  failed: IconX,
  pending: IconClock,
}

const resultColors = {
  passed: 'text-green-600',
  failed: 'text-red-600',
  pending: 'text-yellow-600',
}

const resultLabels = {
  passed: '通过',
  failed: '失败',
  pending: '待测试',
}

export const createColumns = (
  onDelete?: (id: string) => void,
  onDataChange?: () => void,
  onEdit?: (editData: {
    id: string
    mode: 'code'
    data: {
      pythonCode?: string
      notes?: string
    }
  }) => void,
  onShowForm?: (show: boolean) => void
): ColumnDef<AccuracyTest>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-[2px]'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-[2px]'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='测试ID' />
    ),
    cell: ({ row }) => (
      <div className='w-[60px] font-mono text-xs'>
        TEST-{(row.getValue('id') as string).slice(0, 8)}
      </div>
    ),
    size: 80,
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'expected_text',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='期望文本' />
    ),
    cell: ({ row }) => {
      const expectedText = row.getValue('expected_text') as string
      const recognizedText = row.getValue('recognized_text') as string | undefined
      const [isDialogOpen, setIsDialogOpen] = useState(false)
      
      return (
        <div className='max-w-md max-w-md'>
          <div className='text-sm p-2 rounded border mb-2'>
            <div className='text-xs font-medium text-muted-foreground mb-1'>期望文本:</div>
            <div className='break-words whitespace-pre-wrap'>{expectedText}</div>
          </div>
          
          {recognizedText && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-6 px-2 text-xs relative z-10"
                onClick={(e) => {
                  console.log('查看差异按钮被点击')
                  // 阻止事件冒泡，避免触发表格行的点击事件
                  e.stopPropagation()
                  // 直接打开弹窗，让TextDiffDialog处理滚动位置
                  setIsDialogOpen(true)
                }}
                type="button"
              >
                <IconEye className="h-3 w-3 mr-1" />
                查看差异
              </Button>
              
              <CustomModal
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                title="文本差异对比"
              >
                <TextDiff 
                  expected={expectedText} 
                  actual={recognizedText} 
                  showFullText={true}
                />
              </CustomModal>
            </>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'recognized_text',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='识别文本' />
    ),
    cell: ({ row }) => {
      const recognizedText = row.getValue('recognized_text') as string | undefined
      const expectedText = row.getValue('expected_text') as string
      
      if (!recognizedText) {
        return <span className="text-muted-foreground">-</span>
      }
      
      return (
        <div className='max-w-md max-w-md'>
          <div className='text-sm p-2 rounded border'>
            <div className='text-xs font-medium text-muted-foreground mb-1'>识别文本:</div>
            <div className='break-words whitespace-pre-wrap'>{recognizedText}</div>
          </div>
          
          {/* 简单的差异提示 */}
          <div className="mt-1 text-xs text-muted-foreground">
            {(() => {
              const expectedLen = expectedText.length
              const recognizedLen = recognizedText.length
              const lengthDiff = Math.abs(expectedLen - recognizedLen)
              
              if (expectedText === recognizedText) {
                return <span className="text-green-600">✓ 完全匹配</span>
              } else if (lengthDiff === 0) {
                return <span className="text-yellow-600">⚠ 长度相同但内容不同</span>
              } else {
                return <span className="text-red-600">✗ 长度差异: {lengthDiff}字符</span>
              }
            })()}
          </div>
        </div>
      )
    },
  },
  {
    accessorKey: 'similarity',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='文本相似度' />
    ),
    cell: ({ row }) => {
      const similarity = row.getValue('similarity') as number | undefined
      if (similarity === undefined) return <span className="text-muted-foreground">-</span>
      
      const percentage = Math.round(similarity * 100)
      return (
        <div className='flex items-center space-x-2 w-[120px]'>
          <Progress value={percentage} className='flex-1' />
          <span className='text-sm font-medium'>{percentage}%</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'result',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='验证结果' />
    ),
    cell: ({ row }) => {
      const result = row.getValue('result') as 'passed' | 'failed' | 'pending'
      return <ResultCell result={result} />
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='创建时间' />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('created_at') as string)
      return (
        <div className='text-sm text-muted-foreground'>
          {date.toLocaleString('zh-CN')}
        </div>
      )
    },
  },
  {
    accessorKey: 'completed_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='完成时间' />
    ),
    cell: ({ row }) => {
      const date = row.getValue('completed_at') as string | undefined
      if (!date) return <span className="text-muted-foreground">-</span>
      return (
        <div className='text-sm text-muted-foreground'>
          {new Date(date).toLocaleString('zh-CN')}
        </div>
      )
    },
  },
  {
    accessorKey: 'audio_duration',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='音频时长' />
    ),
    cell: ({ row }) => {
      const test = row.original as AccuracyTest
      const duration = test.audio_duration
      const audioData = test.audio_data
      
      if (!audioData) {
        return <span className="text-muted-foreground text-sm">无录音</span>
      }
      
      if (!duration) {
        return <span className="text-muted-foreground text-sm">未知</span>
      }
      
      // 将毫秒转换为秒，保留1位小数
      const seconds = (duration / 1000).toFixed(1)
      return (
        <div className='text-sm font-mono'>
          {seconds}s
        </div>
      )
    },
    enableSorting: true,
    enableHiding: false,
  },
  {
    accessorKey: 'notes',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='备注' />
    ),
    cell: ({ row }) => {
      const notes = row.getValue('notes') as string | undefined
      return (
        <div className='min-w-[150px] max-w-[300px] text-sm text-muted-foreground break-words whitespace-pre-wrap' title={notes}>
          {notes || '-'}
        </div>
      )
    },
  },
  {
    id: 'actions',
    header: '操作',
    cell: ({ row }) => (
      <DataTableRowActions 
        row={row} 
        onDataChange={onDataChange}
        onEdit={onEdit}
        onShowForm={onShowForm}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 120,
  },
]

// 为了向后兼容，保持原来的导出方式
export const columns = createColumns()