import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Button } from './button'

interface CustomModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function CustomModal({ isOpen, onClose, title, children, className }: CustomModalProps) {
  useEffect(() => {
    if (isOpen) {
      // 阻止页面滚动，但不改变滚动位置
      const originalOverflow = document.body.style.overflow
      const originalPosition = document.body.style.position
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollTop}px`
      document.body.style.width = '100%'
      
      return () => {
        // 恢复页面滚动和位置
        document.body.style.overflow = originalOverflow
        document.body.style.position = originalPosition
        document.body.style.top = ''
        document.body.style.width = ''
        window.scrollTo(0, scrollTop)
      }
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 模态框内容 */}
      <div 
        className={cn(
          "relative bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700",
          "max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
} 