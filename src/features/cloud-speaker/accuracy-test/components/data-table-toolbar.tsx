import { Cross2Icon } from '@radix-ui/react-icons'
import { Table } from '@tanstack/react-table'
import { Trash2, Trash } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

import { DataTableFacetedFilter } from './data-table-faceted-filter'
import { DataTableViewOptions } from './data-table-view-options'
import { deleteAccuracyTestsBatch, truncateAccuracyTests } from '@/lib/tauri-api'

const resultOptions = [
  {
    label: '通过',
    value: 'passed',
    icon: undefined,
  },
  {
    label: '失败',
    value: 'failed',
    icon: undefined,
  },
  {
    label: '待测试',
    value: 'pending',
    icon: undefined,
  },
]

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  tableName?: string
  onBatchDelete?: () => void
}

export function DataTableToolbar<TData>({
  table,
  tableName,
  onBatchDelete
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const [isClearingAll, setIsClearingAll] = useState(false)

  const handleBatchDelete = async () => {
    if (selectedCount === 0) {
      toast.error('请先选择要删除的记录')
      return
    }

    try {
      const selectedIds = selectedRows.map(row => (row.original as any).id)
      await deleteAccuracyTestsBatch(selectedIds)
      toast.success(`成功删除 ${selectedCount} 条记录`)
      table.resetRowSelection()
      onBatchDelete?.()
    } catch (error) {
      console.error('批量删除失败:', error)
      toast.error('批量删除失败')
    }
  }

  const handleClearAll = async () => {
    setIsClearingAll(true)
    try {
      const deletedCount = await truncateAccuracyTests()
      toast.success(`成功清空所有记录，共删除 ${deletedCount} 条记录`)
      table.resetRowSelection()
      onBatchDelete?.()
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
          {selectedCount > 0 && (
            <Button
              variant='destructive'
              size='sm'
              onClick={handleBatchDelete}
              className='h-8'
            >
              <Trash2 className='mr-2 h-4 w-4' />
              删除选中 ({selectedCount})
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
        <div className='flex gap-x-2'>
        <Input
          placeholder='搜索期望文本...'
            value={(table.getColumn('expected_text')?.getFilterValue() as string) ?? ''}
            onChange={(event) =>
              table.getColumn('expected_text')?.setFilterValue(event.target.value)
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
          {table.getColumn('result') && (
            <DataTableFacetedFilter
              column={table.getColumn('result')}
              title='验证结果'
              options={resultOptions}
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
      </div>
      <DataTableViewOptions table={table} tableName={tableName} />
    </div>
  )
}
