import { IconCheck, IconX, IconClock } from '@tabler/icons-react'

interface ResultCellProps {
  result: 'passed' | 'failed' | 'pending'
}

const RESULT_CONFIG = {
  passed: {
    icon: IconCheck,
    color: 'text-green-600',
    label: '通过',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  failed: {
    icon: IconX,
    color: 'text-red-600',
    label: '失败',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  pending: {
    icon: IconClock,
    color: 'text-yellow-600',
    label: '待测试',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  }
} as const

export function ResultCell({ result }: ResultCellProps) {
  const config = RESULT_CONFIG[result] || RESULT_CONFIG.pending
  const Icon = config.icon

  if (!config || !Icon) {
    return (
      <div className="flex w-[100px] items-center px-2 py-1 rounded-md border bg-gray-50 border-gray-200">
        <span className="text-sm font-medium text-gray-600">未知状态</span>
      </div>
    )
  }

  return (
    <div className={`flex w-[100px] items-center px-2 py-1 rounded-md border ${config.bgColor} ${config.borderColor}`}>
      <Icon className={`mr-2 h-4 w-4 ${config.color}`} />
      <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
    </div>
  )
}