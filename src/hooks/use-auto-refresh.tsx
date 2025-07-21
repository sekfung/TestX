import { useState, useEffect, useRef, useCallback } from 'react'

export interface AutoRefreshOptions {
  intervals: number[] // 可选的刷新间隔（秒）
  defaultInterval?: number // 默认间隔
  onRefresh: () => Promise<void> | void // 刷新回调函数
}

export function useAutoRefresh({
  intervals = [5, 10, 15, 30],
  defaultInterval,
  onRefresh
}: AutoRefreshOptions) {
  const [isEnabled, setIsEnabled] = useState(false)
  const [interval, setIntervalValue] = useState(defaultInterval || intervals[0] || 10)
  const [countdown, setCountdown] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // 清理定时器
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
  }, [])
  
  // 执行刷新
  const executeRefresh = useCallback(async () => {
    if (isRefreshing) return
    
    try {
      setIsRefreshing(true)
      await onRefresh()
    } catch (error) {
      console.error('自动刷新失败:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh, isRefreshing])
  
  // 启动倒计时
  const startCountdown = useCallback(() => {
    setCountdown(interval)
    
    countdownTimerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return interval // 重置倒计时
        }
        return prev - 1
      })
    }, 1000)
  }, [interval])
  
  // 启动自动刷新
  const startAutoRefresh = useCallback(() => {
    clearTimers()
    
    if (!isEnabled) return
    
    startCountdown()
    
    const refreshTimer = () => {
      timerRef.current = setTimeout(async () => {
        await executeRefresh()
        if (isEnabled) {
          refreshTimer() // 递归调用以继续定时刷新
        }
      }, interval * 1000)
    }
    
    refreshTimer()
  }, [isEnabled, interval, executeRefresh, clearTimers, startCountdown])
  
  // 停止自动刷新
  const stopAutoRefresh = useCallback(() => {
    clearTimers()
    setCountdown(0)
  }, [clearTimers])
  
  // 手动刷新
  const manualRefresh = useCallback(async () => {
    await executeRefresh()
    // 如果自动刷新开启，重新启动定时器
    if (isEnabled) {
      startAutoRefresh()
    }
  }, [executeRefresh, isEnabled, startAutoRefresh])
  
  // 切换自动刷新状态
  const toggleAutoRefresh = useCallback(() => {
    setIsEnabled(prev => !prev)
  }, [])
  
  // 设置刷新间隔
  const setRefreshInterval = useCallback((newInterval: number) => {
    setIntervalValue(newInterval)
    // 如果自动刷新开启，重新启动定时器
    if (isEnabled) {
      clearTimers()
      // 延迟一点启动，确保状态更新完成
      setTimeout(() => {
        startAutoRefresh()
      }, 100)
    }
  }, [isEnabled, clearTimers, startAutoRefresh])
  
  // 监听自动刷新状态变化
  useEffect(() => {
    if (isEnabled) {
      startAutoRefresh()
    } else {
      stopAutoRefresh()
    }
    
    return () => {
      clearTimers()
    }
  }, [isEnabled, startAutoRefresh, stopAutoRefresh, clearTimers])
  
  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])
  
  return {
    isEnabled,
    interval,
    countdown,
    isRefreshing,
    intervals,
    toggleAutoRefresh,
    setRefreshInterval,
    manualRefresh,
    startAutoRefresh,
    stopAutoRefresh
  }
}