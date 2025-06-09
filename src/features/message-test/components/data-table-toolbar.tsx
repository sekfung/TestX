import { Cross2Icon } from '@radix-ui/react-icons'
import { Table } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableViewOptions } from '../components/data-table-view-options'
import { DataTableFacetedFilter } from './data-table-faceted-filter'

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
      </div>
      <DataTableViewOptions table={table} tableName={tableName} />
    </div>
  )
}
