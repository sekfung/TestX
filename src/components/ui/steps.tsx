import React from 'react';
import { cn } from '@/lib/utils';
import { Check, Circle } from 'lucide-react';

export interface Step {
  id: string;
  title: string;
  description?: string;
  status: 'finished' | 'current' | 'waiting';
}

interface StepsProps {
  steps: Step[];
  className?: string;
}

export function Steps({ steps, className }: StepsProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium',
                  {
                    'border-primary bg-primary text-primary-foreground': step.status === 'finished',
                    'border-primary bg-background text-primary': step.status === 'current',
                    'border-muted-foreground bg-background text-muted-foreground': step.status === 'waiting',
                  }
                )}
              >
                {step.status === 'finished' ? (
                  <Check className="h-5 w-5" />
                ) : step.status === 'current' ? (
                  <Circle className="h-3 w-3 fill-current" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              
              {/* Step Content */}
              <div className="mt-2 text-center">
                <div
                  className={cn(
                    'text-sm font-medium',
                    {
                      'text-primary': step.status === 'finished' || step.status === 'current',
                      'text-muted-foreground': step.status === 'waiting',
                    }
                  )}
                >
                  {step.title}
                </div>
                {step.description && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {step.description}
                  </div>
                )}
                {step.status === 'current' && (
                  <div className="mt-1 text-xs text-primary">
                    进行中
                  </div>
                )}
              </div>
            </div>
            
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-4 h-0.5 flex-1 bg-border',
                  {
                    'bg-primary': step.status === 'finished',
                    'bg-muted': step.status === 'waiting' || step.status === 'current',
                  }
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StepContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mt-8 p-6 border rounded-lg bg-card', className)}>
      {children}
    </div>
  );
}

export function StepActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mt-6 flex justify-between', className)}>
      {children}
    </div>
  );
} 