import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { DataTablePagination } from './data-table-pagination'
import { DataTableToolbar } from './data-table-toolbar'
import { createColumns } from './columns'

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
}

interface DataTableProps {
  data: AccuracyTest[]
  columns?: ColumnDef<AccuracyTest>[]
  onDelete?: (id: string) => void
  onDataChange?: () => void
  onEdit?: (editData: {
    id: string
    mode: 'code'
    data: {
      pythonCode?: string
      notes?: string
    }
  }) => void
  onShowForm?: (show: boolean) => void
  onBatchDelete?: () => void
  tableName?: string
}

export function DataTable({ 
  data, 
  columns: providedColumns, 
  onDelete, 
  onDataChange,
  onEdit,
  onShowForm,
  onBatchDelete,
  tableName = 'accuracy-test'
}: DataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  // 使用传入的columns或创建带有回调函数的columns
  const columns = providedColumns || createColumns(onDelete, onDataChange, onEdit, onShowForm)

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  })

  return (
    <div className='space-y-4'>
      <DataTableToolbar table={table} tableName={tableName} onBatchDelete={onBatchDelete} />
      <div className='rounded-md border'>
        <div className='overflow-x-auto'>
          <Table className='min-w-[1400px] table-fixed w-full'>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const width = header.column.columnDef.size
                    return (
                      <TableHead 
                        key={header.id} 
                        colSpan={header.colSpan}
                        style={{ width: width ? `${width}px` : 'auto' }}
                        className={`px-2 ${
                          header.column.id === 'actions' ? 
                          'sticky right-0 bg-background z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]' : ''
                        }`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const width = cell.column.columnDef.size
                      return (
                        <TableCell 
                          key={cell.id}
                          style={{ width: width ? `${width}px` : 'auto' }}
                          className={`px-2 overflow-hidden ${
                            cell.column.id === 'actions' ? 
                            'sticky right-0 bg-background z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]' : ''
                          }`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className='h-24 text-center'
                  >
                    暂无测试记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <DataTablePagination table={table} />
    </div>
  )
}
