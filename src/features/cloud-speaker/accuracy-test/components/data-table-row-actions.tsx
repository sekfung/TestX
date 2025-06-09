import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Row } from '@tanstack/react-table'
import { IconTrash, IconEdit, IconPlayerPlay, IconPlayerPause, IconCopy, IconRefresh, IconDots } from '@tabler/icons-react'
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
import { invoke } from '@tauri-apps/api/core'
import { useState } from 'react'

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
  audio_data?: string
  audio_duration?: number
}

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
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
}

export function DataTableRowActions<TData>({
  row,
  onDataChange,
  onEdit,
  onShowForm,
}: DataTableRowActionsProps<TData>) {
  const test = row.original as AccuracyTest
  const [isPlaying, setIsPlaying] = useState(false)
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null)

  const handleRetest = async () => {
    try {
      // 创建一个新的测试记录来重新测试
      const request = {
        expected_text: test.expected_text,
        mode: 'code',
        python_code: test.python_code,
        notes: test.notes
      }
      
      const newTest = await invoke<AccuracyTest>('create_accuracy_test', { request })
      toast.success('重新测试已创建，请开始录音')
      onDataChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '重新测试失败')
    }
  }

  const handleEdit = async () => {
    try {
      onEdit?.({
        id: test.id,
        mode: 'code',
        data: {
          pythonCode: test.python_code,
          notes: test.notes,
        }
      })
      onShowForm?.(true)
    } catch (error) {
      toast.error('编辑失败')
    }
  }

  const handleCopy = () => {
    const data = {
      expected_text: test.expected_text,
      python_code: test.python_code,
      mode: test.mode,
      notes: test.notes,
    }
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    toast.success('已复制到剪贴板')
  }

  const handlePlayPause = () => {
    if (!test.audio_data) {
      toast.error('没有录音数据')
      return
    }
    
    try {
      if (!audio) {
        // 创建音频对象
        const audioBlob = new Blob(
          [Uint8Array.from(atob(test.audio_data), c => c.charCodeAt(0))],
          { type: 'audio/ogg;codecs=opus' }
        )
        const audioUrl = URL.createObjectURL(audioBlob)
        const newAudio = new Audio(audioUrl)
        
        newAudio.onended = () => {
          setIsPlaying(false)
          URL.revokeObjectURL(audioUrl)
          setAudio(null)
        }
        
        newAudio.onerror = () => {
          toast.error('音频播放失败')
          setIsPlaying(false)
          URL.revokeObjectURL(audioUrl)
          setAudio(null)
        }
        
        setAudio(newAudio)
        newAudio.play()
        setIsPlaying(true)
      } else {
        if (isPlaying) {
          audio.pause()
          setIsPlaying(false)
        } else {
          audio.play()
          setIsPlaying(true)
        }
      }
    } catch (error) {
      console.error('音频播放错误:', error)
      toast.error('音频播放失败')
    }
  }

  const handleDelete = async () => {
    try {
      await invoke('delete_accuracy_test', { id: test.id })
      toast.success('删除成功')
      onDataChange?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    }
  }

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
        {test.audio_data && (
          <>
            <DropdownMenuItem onClick={handlePlayPause}>
              {isPlaying ? '暂停播放' : '播放录音'}
              <DropdownMenuShortcut>
                {isPlaying ? (
                  <IconPlayerPause size={16} />
                ) : (
                  <IconPlayerPlay size={16} />
                )}
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={handleRetest}>
          重新测试
          <DropdownMenuShortcut>
            <IconRefresh size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleEdit}>
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
