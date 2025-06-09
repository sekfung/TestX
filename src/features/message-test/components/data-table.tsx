import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
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
import { DataTablePagination } from '../components/data-table-pagination'
import { DataTableToolbar } from '../components/data-table-toolbar'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  tableName: string
}

export function DataTable<TData, TValue>({
  columns,
  data,
  tableName,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [sorting, setSorting] = React.useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return (
    <div className='space-y-4'>
      <DataTableToolbar table={table} tableName={tableName} />
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
                    No results.
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
