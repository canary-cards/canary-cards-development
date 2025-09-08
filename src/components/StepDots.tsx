import React from 'react';
import { useIsMobile } from '../hooks/use-mobile';

interface StepDotsProps {
  currentStep: number;
  totalSteps: number;
}

export function StepDots({ currentStep, totalSteps }: StepDotsProps) {
  const isMobile = useIsMobile();

  // Mobile: Use dots
  if (isMobile) {
    return (
      <div className="flex items-center justify-between gap-2 py-4 max-w-2xl mx-auto px-4">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          
          return (
            <div
              key={stepNumber}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                isCompleted 
                  ? 'bg-primary' 
                  : isCurrent 
                    ? 'bg-accent ring-2 ring-accent/20' 
                    : 'bg-muted'
              }`}
              aria-label={`Step ${stepNumber}${isCompleted ? ' completed' : isCurrent ? ' current' : ''}`}
            />
          );
        })}
      </div>
    );
  }

  // Desktop: Use progress strips like onboarding
  return (
    <div className="flex gap-1 px-4 py-4 max-w-2xl mx-auto">
      {Array.from({ length: totalSteps }, (_, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;
        
        return (
          <div
            key={stepNumber}
            className="flex-1 h-2 bg-muted rounded-full overflow-hidden"
            aria-label={`Step ${stepNumber}${isCompleted ? ' completed' : isCurrent ? ' current' : ''}`}
          >
            <div
              className={`h-full transition-all duration-300 ease-out ${
                isCompleted 
                  ? 'bg-primary' 
                  : isCurrent 
                    ? 'bg-accent'
                    : 'bg-muted'
              }`}
              style={{
                width: isCompleted || isCurrent ? '100%' : '0%'
              }}
            />
          </div>
        );
      })}
    </div>
  );
}