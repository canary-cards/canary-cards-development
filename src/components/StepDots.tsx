import React from 'react';

interface StepDotsProps {
  currentStep: number;
  totalSteps: number;
}

export function StepDots({ currentStep, totalSteps }: StepDotsProps) {
  return (
    <div className="flex gap-1 px-4 pt-2 pb-4 max-w-2xl mx-auto">
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
                    ? 'bg-primary'
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