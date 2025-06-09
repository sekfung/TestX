import React from 'react'
import { cn } from '@/lib/utils'

interface TextDiffProps {
  expected: string
  actual: string
  className?: string
  showFullText?: boolean
}

interface DiffPart {
  text: string
  type: 'equal' | 'insert' | 'delete'
}

// 简单的文本差异算法
function computeDiff(expected: string, actual: string): DiffPart[] {
  const expectedChars = Array.from(expected)
  const actualChars = Array.from(actual)
  
  const dp: number[][] = []
  const m = expectedChars.length
  const n = actualChars.length
  
  // 初始化DP表
  for (let i = 0; i <= m; i++) {
    dp[i] = []
    for (let j = 0; j <= n; j++) {
      if (i === 0) dp[i][j] = j
      else if (j === 0) dp[i][j] = i
      else if (expectedChars[i - 1] === actualChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }
  
  // 回溯构建差异
  const result: DiffPart[] = []
  let i = m, j = n
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expectedChars[i - 1] === actualChars[j - 1]) {
      // 相同字符
      result.unshift({ text: expectedChars[i - 1], type: 'equal' })
      i--
      j--
    } else if (i > 0 && (j === 0 || dp[i - 1][j] <= dp[i][j - 1])) {
      // 删除字符（期望中有，实际中没有）
      result.unshift({ text: expectedChars[i - 1], type: 'delete' })
      i--
    } else {
      // 插入字符（实际中有，期望中没有）
      result.unshift({ text: actualChars[j - 1], type: 'insert' })
      j--
    }
  }
  
  // 合并相邻的相同类型
  const merged: DiffPart[] = []
  for (const part of result) {
    const last = merged[merged.length - 1]
    if (last && last.type === part.type) {
      last.text += part.text
    } else {
      merged.push(part)
    }
  }
  
  return merged
}

export function TextDiff({ expected, actual, className, showFullText = false }: TextDiffProps) {
  const diff = computeDiff(expected, actual)
  
  return (
    <div className={cn("space-y-2", className)}>
      {/* 期望文本 */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">期望文本:</div>
        <div className={cn(
          "text-sm p-2 rounded border bg-green-50 dark:bg-green-950/20",
          !showFullText && "max-w-[300px] truncate"
        )} title={expected}>
          {expected}
        </div>
      </div>
      
      {/* 识别文本（带差异标注） */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-muted-foreground">识别文本:</div>
        <div className={cn(
          "text-sm p-2 rounded border bg-red-50 dark:bg-red-950/20",
          !showFullText && "max-w-[300px]"
        )}>
          {diff.map((part, index) => (
            <span
              key={index}
              className={cn(
                part.type === 'equal' && "text-gray-900 dark:text-gray-100",
                part.type === 'insert' && "bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100 px-0.5 rounded",
                part.type === 'delete' && "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400 line-through px-0.5 rounded opacity-60"
              )}
              title={
                part.type === 'insert' ? '多余的文本' :
                part.type === 'delete' ? '缺失的文本' : 
                undefined
              }
            >
              {part.text}
            </span>
          ))}
        </div>
      </div>
      
      {/* 差异统计 */}
      <div className="text-xs text-muted-foreground">
        {(() => {
          const insertCount = diff.filter(p => p.type === 'insert').reduce((sum, p) => sum + p.text.length, 0)
          const deleteCount = diff.filter(p => p.type === 'delete').reduce((sum, p) => sum + p.text.length, 0)
          const equalCount = diff.filter(p => p.type === 'equal').reduce((sum, p) => sum + p.text.length, 0)
          const total = expected.length
          const accuracy = total > 0 ? ((equalCount / total) * 100).toFixed(1) : '0.0'
          
          return (
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="text-green-600">✓ 正确: {equalCount}</span>
              <span className="text-red-600">+ 多余: {insertCount}</span>
              <span className="text-gray-600">- 缺失: {deleteCount}</span>
              <span className="font-medium">准确率: {accuracy}%</span>
            </div>
          )
        })()}
      </div>
    </div>
  )
} 