import { useLogStore } from '@/stores/logStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LogTrigger() {
  const { toggleConsole, logs, isConsoleOpen } = useLogStore()
  
  const errorCount = logs.filter(log => log.level === 'error').length
  const warningCount = logs.filter(log => log.level === 'warn').length
  
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        onClick={toggleConsole}
        className={cn(
          "h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300",
          "bg-gray-900 hover:bg-gray-800 text-white border-2 border-gray-700",
          isConsoleOpen && "bg-blue-600 hover:bg-blue-700 border-blue-500"
        )}
        size="icon"
      >
        <Terminal className="h-6 w-6" />
        
        {/* Error/Warning indicator */}
        {(errorCount > 0 || warningCount > 0) && (
          <div className="absolute -top-2 -right-2 flex gap-1">
            {errorCount > 0 && (
              <Badge 
                variant="destructive" 
                className="h-6 min-w-6 text-xs px-1.5 rounded-full animate-pulse"
              >
                {errorCount > 99 ? '99+' : errorCount}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge 
                variant="secondary" 
                className="h-6 min-w-6 text-xs px-1.5 rounded-full bg-yellow-500 text-white animate-pulse"
              >
                {warningCount > 99 ? '99+' : warningCount}
              </Badge>
            )}
          </div>
        )}
        
        {/* Total logs indicator */}
        {logs.length > 0 && !(errorCount > 0 || warningCount > 0) && (
          <Badge 
            variant="secondary" 
            className="absolute -top-2 -right-2 h-6 min-w-6 text-xs px-1.5 rounded-full bg-blue-500 text-white"
          >
            {logs.length > 99 ? '99+' : logs.length}
          </Badge>
        )}
      </Button>
    </div>
  )
} 