import React from 'react';

interface StepDotsProps {
  currentStep: number;
  totalSteps: number;
}

export function StepDots({ currentStep, totalSteps }: StepDotsProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
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