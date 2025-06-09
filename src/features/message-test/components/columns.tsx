import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { MessageTest } from '../data/message-tests'
import { DataTableColumnHeader } from './data-table-column-header'
import { DataTableRowActions } from './data-table-row-actions'
import { IconCheck, IconX, IconClock, IconSend, IconCode, IconFileText } from '@tabler/icons-react'

// 时间格式化函数
const formatDateTime = (dateString?: string): string => {
  if (!dateString) return '-'
  
  try {
    const date = new Date(dateString)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    
    return `${month}-${day} ${hours}:${minutes}:${seconds}`
  } catch {
    return dateString
  }
}

const statusIcons = {
  pending: IconClock,
  sent: IconSend,
  failed: IconX,
}

const statusColors = {
  pending: 'text-yellow-600',
  sent: 'text-green-600',
  failed: 'text-red-600',
}

const statusLabels = {
  pending: '待发送',
  sent: '已发送',
  failed: '发送失败',
}

const qosColors = {
  0: 'bg-gray-100 text-gray-800',
  1: 'bg-blue-100 text-blue-800',
  2: 'bg-green-100 text-green-800',
}

const qosLabels = {
  0: 'QoS 0',
  1: 'QoS 1', 
  2: 'QoS 2',
}

export const createColumns = (
  onDataChange?: () => void,
  onEdit?: (editData: {
    id: string
    mode: 'form' | 'code'
    data: {
      topic: string
      qosLevel: '0' | '1' | '2'
      payload: string
      productKey: string
      deviceName: string
      pythonCode?: string
    }
  }) => void,
  onShowForm?: (show: boolean) => void,
  onSetMode?: (mode: 'form' | 'code') => void
): ColumnDef<MessageTest>[] => [
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
    size: 50,
  },
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='报文ID' />
    ),
    cell: ({ row }) => {
      const id = row.getValue('id') as string
      const shortId = id.length > 8 ? id.substring(0, 8) : id
      return (
        <div className='w-[120px] font-mono text-xs' title={`MSG-${id}`}>
          MSG-{shortId}
        </div>
      )
    },
    enableSorting: false,
    enableHiding: false,
    size: 120,
  },
  {
    accessorKey: 'topic',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='主题' />
    ),
    cell: ({ row }) => (
      <div 
        className='min-w-[350px] font-medium font-mono text-sm break-all whitespace-normal leading-tight py-1' 
        title={row.getValue('topic')}
      >
        {row.getValue('topic')}
      </div>
    ),
    size: 380,
  },
  {
    accessorKey: 'qosLevel',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='QoS等级' />
    ),
    cell: ({ row }) => {
      const qosLevel = row.getValue('qosLevel') as 0 | 1 | 2
      const colorClass = qosColors[qosLevel]
      const label = qosLabels[qosLevel]

      return (
        <div className='w-[80px]'>
          <Badge className={`${colorClass} border-0`}>
            {label}
          </Badge>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    size: 80,
  },
  {
    accessorKey: 'payload',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='报文内容' />
    ),
    cell: ({ row }) => {
      const payload = row.getValue('payload') as string;
      
      // Try to format JSON if valid
      let formattedPayload = payload;
      let isJson = false;
      
      try {
        if (payload && payload.trim()) {
          const parsed = JSON.parse(payload);
          formattedPayload = JSON.stringify(parsed, null, 2);
          isJson = true;
        }
      } catch {
        // Not valid JSON, use as-is
      }
      
      return (
        <div 
          className={`min-w-[200px] max-w-[280px] whitespace-pre overflow-hidden text-ellipsis font-mono text-sm ${isJson ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded' : ''}`} 
          title={isJson ? "点击查看格式化JSON" : payload}
          onClick={() => {
            if (isJson) {
              // Show formatted JSON in a modal or toast
              import('sonner').then(({ toast }) => {
                toast.message("JSON内容", {
                  description: (
                    <pre className="mt-2 w-full max-h-[400px] overflow-auto rounded-md bg-slate-950 p-4">
                      <code className="text-white">{formattedPayload}</code>
                    </pre>
                  ),
                  duration: 10000,
                });
              });
            }
          }}
        >
          {payload}
        </div>
      )
    },
    size: 240,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='状态' />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as keyof typeof statusIcons
      const Icon = statusIcons[status]
      const colorClass = statusColors[status]
      const label = statusLabels[status]

      return (
        <div className='flex w-[100px] items-center'>
          <Icon className={`mr-2 h-4 w-4 ${colorClass}`} />
          <span className={colorClass}>{label}</span>
        </div>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    size: 100,
  },
  {
    accessorKey: 'sentAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='发送时间' />
    ),
    cell: ({ row }) => {
      const sentAt = row.getValue('sentAt') as string | undefined
      return (
        <div className='w-[120px] text-sm text-muted-foreground font-mono' title={sentAt}>
          {formatDateTime(sentAt)}
        </div>
      )
    },
    size: 120,
  },
  {
    accessorKey: 'response',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='响应' />
    ),
    cell: ({ row }) => {
      const response = row.getValue('response') as string | undefined
      return (
        <div className='min-w-[180px] max-w-[220px] truncate font-mono text-sm' title={response}>
          {response || '-'}
        </div>
      )
    },
    size: 200,
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='创建时间' />
    ),
    cell: ({ row }) => {
      const createdAt = row.getValue('createdAt') as string
      return (
        <div className='w-[120px] text-sm text-muted-foreground font-mono' title={createdAt}>
          {formatDateTime(createdAt)}
        </div>
      )
    },
    size: 120,
  },
  {
    accessorKey: 'mode',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='模式' />
    ),
    cell: ({ row }) => {
      const mode = row.getValue('mode') as 'form' | 'code'
      return (
        <Badge variant={mode === 'code' ? 'default' : 'secondary'}>
          {mode === 'code' ? (
            <>
              <IconCode className="w-3 h-3 mr-1" />
              代码
            </>
          ) : (
            <>
              <IconFileText className="w-3 h-3 mr-1" />
              表单
            </>
          )}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    size: 80,
  },
  {
    accessorKey: 'notes',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='备注' />
    ),
    cell: ({ row }) => {
      const notes = row.getValue('notes') as string | undefined
      return (
        <div className='min-w-[150px] max-w-[200px] truncate text-sm text-muted-foreground' title={notes}>
          {notes || '-'}
        </div>
      )
    },
    size: 180,
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DataTableRowActions 
        row={row} 
        onDataChange={onDataChange}
        onEdit={onEdit}
        onShowForm={onShowForm}
        onSetMode={onSetMode}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 120,
  },
]

// 保持向后兼容性的默认导出
export const columns = createColumns() 