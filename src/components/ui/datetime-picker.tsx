"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  timezone?: string;
  renderTrigger?: (value: Date | undefined, timezone?: string) => React.ReactNode;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  disabled = false,
  className,
  minDate,
  maxDate,
  timezone,
  renderTrigger,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(value);
  
  // 获取当前时间作为默认时间
  const getDefaultTime = () => {
    const now = new Date();
    return {
      hours: now.getHours(),
      minutes: now.getMinutes(),
      seconds: now.getSeconds(),
    };
  };
  
  const [timeValue, setTimeValue] = React.useState(
    value ? {
      hours: value.getHours(),
      minutes: value.getMinutes(),
      seconds: value.getSeconds(),
    } : getDefaultTime()
  );

  React.useEffect(() => {
    setSelectedDate(value);
    if (value) {
      setTimeValue({
        hours: value.getHours(),
        minutes: value.getMinutes(),
        seconds: value.getSeconds(),
      });
    }
  }, [value]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      let newTimeValue = timeValue;
      
      // 如果选择的是今天，确保时间不早于当前时间
      if (isToday) {
        const currentTime = getDefaultTime();
        const selectedTime = new Date(date);
        selectedTime.setHours(timeValue.hours, timeValue.minutes, timeValue.seconds);
        
        if (selectedTime <= now) {
          // 如果当前选择的时间已经过去，设置为当前时间
          newTimeValue = currentTime;
          setTimeValue(newTimeValue);
        }
      }
      
      const newDate = new Date(date);
      newDate.setHours(newTimeValue.hours, newTimeValue.minutes, newTimeValue.seconds);
      setSelectedDate(newDate);
      onChange?.(newDate);
    } else {
      setSelectedDate(undefined);
      onChange?.(undefined);
    }
  };

  const handleTimeChange = (type: 'hours' | 'minutes' | 'seconds', value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;

    const newTimeValue = { ...timeValue, [type]: numValue };
    setTimeValue(newTimeValue);

    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(newTimeValue.hours, newTimeValue.minutes, newTimeValue.seconds);
      
      // 检查选择的时间是否是未来时间
      const now = new Date();
      if (newDate <= now) {
        // 如果选择的时间不是未来时间，不更新
        return;
      }
      
      setSelectedDate(newDate);
      onChange?.(newDate);
    }
  };

  const isDateDisabled = (date: Date) => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    
    // 可以选择今天及未来日期
    if (checkDate < today) return true;
    
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  // 获取当前时间，用于动态设置最小时间
  const getCurrentTime = () => {
    return new Date();
  };

  // 检查时间选项是否应该被禁用
  const isTimeOptionDisabled = (type: 'hours' | 'minutes' | 'seconds', value: number) => {
    if (!selectedDate) return false;
    
    const now = getCurrentTime();
    const testDate = new Date(selectedDate);
    
    // 如果选择的不是今天，则不需要限制时间
    if (testDate.toDateString() !== now.toDateString()) {
      return false;
    }
    
    // 如果是今天，需要检查时间是否是未来时间
    const testTime = { ...timeValue };
    testTime[type] = value;
    
    // 根据当前选择的类型和值设置测试日期的时间
    if (type === 'hours') {
      testDate.setHours(value, timeValue.minutes, timeValue.seconds);
    } else if (type === 'minutes') {
      testDate.setHours(timeValue.hours, value, timeValue.seconds);
    } else if (type === 'seconds') {
      testDate.setHours(timeValue.hours, timeValue.minutes, value);
    }
    
    return testDate <= now;
  };

  const formatDisplayValue = (date: Date | undefined) => {
    if (!date) return placeholder;
    if (timezone) {
      return date.toLocaleString('zh-CN', { timeZone: timezone });
    }
    return format(date, "yyyy-MM-dd HH:mm:ss");
  };

  const triggerContent = renderTrigger ? (
    renderTrigger(selectedDate, timezone)
  ) : (
    <Button
      variant="outline"
      className={cn(
        "w-[280px] justify-start text-left font-normal",
        !selectedDate && "text-muted-foreground",
        className
      )}
      disabled={disabled}
    >
      <CalendarIcon className="mr-2 h-4 w-4" />
      {formatDisplayValue(selectedDate)}
    </Button>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {triggerContent}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={isDateDisabled}
            initialFocus
          />
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4" />
              <Label className="text-sm font-medium">时间</Label>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">时</Label>
                <Select
                  value={timeValue.hours.toString()}
                  onValueChange={(value) => handleTimeChange('hours', value)}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem 
                        key={i} 
                        value={i.toString()}
                        disabled={isTimeOptionDisabled('hours', i)}
                        className="h-8"
                      >
                        {i.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">分</Label>
                <Select
                  value={timeValue.minutes.toString()}
                  onValueChange={(value) => handleTimeChange('minutes', value)}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {Array.from({ length: 60 }, (_, i) => (
                      <SelectItem 
                        key={i} 
                        value={i.toString()}
                        disabled={isTimeOptionDisabled('minutes', i)}
                        className="h-8"
                      >
                        {i.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">秒</Label>
                <Select
                  value={timeValue.seconds.toString()}
                  onValueChange={(value) => handleTimeChange('seconds', value)}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {Array.from({ length: 60 }, (_, i) => (
                      <SelectItem 
                        key={i} 
                        value={i.toString()}
                        disabled={isTimeOptionDisabled('seconds', i)}
                        className="h-8"
                      >
                        {i.toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="border-t pt-3 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-sm font-medium">快捷选项</Label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const now = new Date();
                  const futureTime = new Date(now.getTime() + 1 * 60 * 1000); // 1分钟后
                  setSelectedDate(futureTime);
                  setTimeValue({
                    hours: futureTime.getHours(),
                    minutes: futureTime.getMinutes(),
                    seconds: futureTime.getSeconds(),
                  });
                  onChange?.(futureTime);
                }}
              >
                1分钟后
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const now = new Date();
                  const futureTime = new Date(now.getTime() + 5 * 60 * 1000); // 5分钟后
                  setSelectedDate(futureTime);
                  setTimeValue({
                    hours: futureTime.getHours(),
                    minutes: futureTime.getMinutes(),
                    seconds: futureTime.getSeconds(),
                  });
                  onChange?.(futureTime);
                }}
              >
                5分钟后
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const now = new Date();
                  const futureTime = new Date(now.getTime() + 60 * 60 * 1000); // 1小时后
                  setSelectedDate(futureTime);
                  setTimeValue({
                    hours: futureTime.getHours(),
                    minutes: futureTime.getMinutes(),
                    seconds: futureTime.getSeconds(),
                  });
                  onChange?.(futureTime);
                }}
              >
                1小时后
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const now = new Date();
                  const futureTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1天后
                  setSelectedDate(futureTime);
                  setTimeValue({
                    hours: futureTime.getHours(),
                    minutes: futureTime.getMinutes(),
                    seconds: futureTime.getSeconds(),
                  });
                  onChange?.(futureTime);
                }}
              >
                1天后
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}