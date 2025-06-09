import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Row } from '@tanstack/react-table'
import { IconTrash, IconEdit, IconSend, IconCopy, IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { MessageTest, deleteMessageTest, sendMessage, retestMessage, getMessageTestById } from '../data/message-tests'

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
  onDataChange?: () => void // 回调函数通知父组件数据发生变化
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
  }) => void
  onShowForm?: (show: boolean) => void
  onSetMode?: (mode: 'form' | 'code') => void
}

export function DataTableRowActions<TData>({
  row,
  onDataChange,
  onEdit,
  onShowForm,
  onSetMode,
}: DataTableRowActionsProps<TData>) {
  const message = row.original as MessageTest

  const handleResend = async () => {
    try {
      const messageId = await sendMessage(
        message.topic, 
        message.qosLevel, 
        message.payload,
        message.productKey || '',
        message.deviceName || '',
        message.mode
      )
      toast.success(`报文重新发送成功，消息ID: ${messageId}`)
      onDataChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '重新发送失败')
    }
  }

  const handleRetest = async () => {
    try {
      const messageId = await retestMessage(message.id)
      toast.success(`重新测试成功，消息ID: ${messageId}`)
      onDataChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '重新测试失败')
    }
  }

  const handleEdit = async () => {
    try {
      const testData = await getMessageTestById(message.id)
      if (!testData) {
        toast.error('获取测试数据失败')
        return
      }

      // 只有代码模式的记录可以编辑
      if (testData.mode !== 'code') {
        toast.error('只有代码模式的记录可以编辑')
        return
      }

      onEdit?.({
        id: testData.id,
        mode: testData.mode,
        data: {
          topic: testData.topic,
          qosLevel: testData.qosLevel.toString() as '0' | '1' | '2',
          payload: testData.payload,
          productKey: testData.productKey || '',
          deviceName: testData.deviceName || '',
          pythonCode: testData.pythonCode,
        }
      })
      onSetMode?.(testData.mode)
      onShowForm?.(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '编辑失败')
    }
  }

  const handleCopy = () => {
    const data = {
      topic: message.topic,
      qosLevel: message.qosLevel,
      payload: message.payload,
      productKey: message.productKey,
      deviceName: message.deviceName,
      mode: message.mode,
      pythonCode: message.pythonCode,
    }
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    toast.success('已复制到剪贴板')
  }

  const handleDelete = async () => {
    try {
      await deleteMessageTest(message.id)
      toast.success('删除成功')
      onDataChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

  const isCodeMode = message.mode === 'code'

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='data-[state=open]:bg-muted flex h-8 w-8 p-0'
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[160px]'>
        <DropdownMenuItem onClick={handleRetest}>
          重新测试
          <DropdownMenuShortcut>
            <IconRefresh size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleResend}>
          重新发送
          <DropdownMenuShortcut>
            <IconSend size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={handleEdit}
          disabled={!isCodeMode}
        >
          编辑
          <DropdownMenuShortcut>
            <IconEdit size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          复制
          <DropdownMenuShortcut>
            <IconCopy size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>查看详情</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          className='text-red-600'
          onClick={handleDelete}
        >
          删除
          <DropdownMenuShortcut>
            <IconTrash size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
