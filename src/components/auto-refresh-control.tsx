import React from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { IconRefresh, IconClock } from '@tabler/icons-react'
import { useAutoRefresh, type AutoRefreshOptions } from '@/hooks/use-auto-refresh'

interface AutoRefreshControlProps {
  onRefresh: () => Promise<void> | void
  intervals?: number[]
  defaultInterval?: number
  className?: string
}

export function AutoRefreshControl({
  onRefresh,
  intervals = [5, 10, 15, 30],
  defaultInterval,
  className = ''
}: AutoRefreshControlProps) {
  const {
    isEnabled,
    interval,
    countdown,
    isRefreshing,
    toggleAutoRefresh,
    setRefreshInterval,
    manualRefresh
  } = useAutoRefresh({
    intervals,
    defaultInterval,
    onRefresh
  })

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {/* 手动刷新按钮 */}
      <Button 
        variant='outline' 
        onClick={manualRefresh}
        disabled={isRefreshing}
        size="sm"
      >
        <IconRefresh className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        刷新
      </Button>
      
      {/* 自动刷新开关 */}
      <div className="flex items-center space-x-2">
        <Switch
          id="auto-refresh"
          checked={isEnabled}
          onCheckedChange={toggleAutoRefresh}
        />
        <Label htmlFor="auto-refresh" className="text-sm font-medium">
          自动刷新
        </Label>
      </div>
      
      {/* 刷新间隔选择 */}
      {isEnabled && (
        <>
          <Select
            value={interval.toString()}
            onValueChange={(value) => setRefreshInterval(parseInt(value))}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intervals.map((intervalOption) => (
                <SelectItem key={intervalOption} value={intervalOption.toString()}>
                  {intervalOption}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* 倒计时显示 */}
          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
            <IconClock className="h-3 w-3" />
            <span>{countdown}s</span>
          </div>
        </>
      )}
    </div>
  )
}