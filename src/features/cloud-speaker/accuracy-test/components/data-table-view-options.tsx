import React, { useEffect } from 'react';
import { DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu'
import { MixerHorizontalIcon } from '@radix-ui/react-icons'
import { Table } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>
  tableName?: string // Unique identifier for this table (e.g., 'message-test', 'accuracy-test')
}

export function DataTableViewOptions<TData>({
  table,
  tableName,
}: DataTableViewOptionsProps<TData>) {
  // Load saved preferences when component mounts
  useEffect(() => {
    const loadPreferences = async () => {
      if (!tableName) return;
      
      try {
        const result = await invoke<string | null>('load_user_preference', { 
          preferenceType: `table_columns_${tableName}`
        });
        
        if (result) {
          const savedColumnVisibility = JSON.parse(result);
          table.setColumnVisibility(savedColumnVisibility);
        }
      } catch (error) {
        console.error('Failed to load column preferences:', error);
      }
    };
    
    loadPreferences();
  }, [table, tableName]);
  
  // Save preferences when visibility changes
  const handleVisibilityChange = async (columnId: string, visible: boolean) => {
    const newVisibility = {
      ...table.getState().columnVisibility,
      [columnId]: visible,
    };
    
    table.setColumnVisibility(newVisibility);
    
    if (!tableName) return;
    
    try {
      await invoke('save_user_preference', {
        preferenceType: `table_columns_${tableName}`,
        preferenceData: JSON.stringify(newVisibility),
      });
    } catch (error) {
      console.error('Failed to save column preferences:', error);
      toast.error('保存列可见性偏好设置失败');
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='ml-auto hidden h-8 lg:flex'
        >
          <MixerHorizontalIcon className='mr-2 h-4 w-4' />
          视图
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[150px]'>
        <DropdownMenuLabel>切换列</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== 'undefined' && column.getCanHide()
          )
          .map((column) => {
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className='capitalize'
                checked={column.getIsVisible()}
                onCheckedChange={(value) => handleVisibilityChange(column.id, !!value)}
              >
                {column.id}
              </DropdownMenuCheckboxItem>
            )
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
