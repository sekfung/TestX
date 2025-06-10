import { Cross2Icon } from '@radix-ui/react-icons'
import { Table } from '@tanstack/react-table'
import { Trash2, Trash } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

import { DataTableFacetedFilter } from './data-table-faceted-filter'
import { DataTableViewOptions } from './data-table-view-options'
import { deleteMessageTestsBatch, truncateMessageTests } from '@/features/message-test/data/message-tests'

const statusOptions = [
  {
    label: '待发送',
    value: 'pending',
    icon: undefined,
  },
  {
    label: '已发送',
    value: 'sent',
    icon: undefined,
  },
  {
    label: '发送失败',
    value: 'failed',
    icon: undefined,
  },
]

const qosOptions = [
  {
    label: 'QoS 0',
    value: '0',
    icon: undefined,
  },
  {
    label: 'QoS 1',
    value: '1',
    icon: undefined,
  },
  {
    label: 'QoS 2',
    value: '2',
    icon: undefined,
  },
]

const modeOptions = [
  {
    label: '表单',
    value: 'form',
    icon: undefined,
  },
  {
    label: '代码',
    value: 'code',
    icon: undefined,
  },
]

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  tableName: string
  onDataChange?: () => void
}

export function DataTableToolbar<TData>({
  table,
  tableName,
  onDataChange,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0
  const [isDeleting, setIsDeleting] = useState(false)
  const [isClearingAll, setIsClearingAll] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length

  const handleBatchDelete = async () => {
    if (selectedCount === 0) {
      toast.error('请先选择要删除的记录')
      return
    }

    setIsDeleting(true)
    try {
      const ids = selectedRows.map(row => (row.original as any).id)
      await deleteMessageTestsBatch(ids)
      toast.success(`成功删除 ${selectedCount} 条记录`)
      table.resetRowSelection()
      onDataChange?.()
    } catch (error) {
      console.error('批量删除失败:', error)
      toast.error('批量删除失败，请重试')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleClearAll = async () => {
    setIsClearingAll(true)
    try {
      const deletedCount = await truncateMessageTests()
      toast.success(`成功清空所有记录，共删除 ${deletedCount} 条记录`)
      table.resetRowSelection()
      onDataChange?.()
    } catch (error) {
      console.error('清空记录失败:', error)
      toast.error('清空记录失败')
    } finally {
      setIsClearingAll(false)
    }
  }

  return (
    <div className='flex items-center justify-between'>
      <div className='flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2'>
        <div className='flex gap-x-2'>
          <Input
            placeholder='搜索主题...'
            value={(table.getColumn('topic')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('topic')?.setFilterValue(event.target.value)
            }
            className='h-8 w-[150px] lg:w-[200px]'
          />
          <Input
            placeholder='搜索备注...'
            value={(table.getColumn('notes')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('notes')?.setFilterValue(event.target.value)
            }
            className='h-8 w-[120px] lg:w-[150px]'
          />
        </div>
        <div className='flex gap-x-2'>
          {table.getColumn('status') && (
            <DataTableFacetedFilter
              column={table.getColumn('status')}
              title='状态'
              options={statusOptions}
            />
          )}
          {table.getColumn('qosLevel') && (
            <DataTableFacetedFilter
              column={table.getColumn('qosLevel')}
              title='QoS等级'
              options={qosOptions}
            />
          )}
          {table.getColumn('mode') && (
            <DataTableFacetedFilter
              column={table.getColumn('mode')}
              title='模式'
              options={modeOptions}
            />
          )}
        </div>
        {isFiltered && (
          <Button
            variant='ghost'
            onClick={() => table.resetColumnFilters()}
            className='h-8 px-2 lg:px-3'
          >
            重置
            <Cross2Icon className='ml-2 h-4 w-4' />
          </Button>
        )}
        <div className='flex gap-x-2'>
          {selectedCount > 0 && (
            <Button
              variant='destructive'
              size='sm'
              onClick={handleBatchDelete}
              disabled={isDeleting}
              className='h-8'
            >
              <Trash2 className='mr-2 h-4 w-4' />
              {isDeleting ? '删除中...' : `删除 ${selectedCount} 项`}
            </Button>
          )}
          <Button
            variant='outline'
            size='sm'
            onClick={handleClearAll}
            disabled={isClearingAll}
            className='h-8'
          >
            <Trash className='mr-2 h-4 w-4' />
            {isClearingAll ? '清空中...' : '清空所有'}
          </Button>
        </div>
      </div>
      <DataTableViewOptions table={table} tableName={tableName} />
    </div>
  )
}
