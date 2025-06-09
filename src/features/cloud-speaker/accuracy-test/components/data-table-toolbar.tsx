import { Cross2Icon } from '@radix-ui/react-icons'
import { Table } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from '../components/data-table-view-options'
import { DataTableFacetedFilter } from './data-table-faceted-filter'

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
  tableName: string
}

export function DataTableToolbar<TData>({
  table,
  tableName,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className='flex items-center justify-between'>
      <div className='flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2'>
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
