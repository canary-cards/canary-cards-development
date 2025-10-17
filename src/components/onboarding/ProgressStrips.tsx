import React from 'react';

interface ProgressStripsProps {
  currentSlide: number;
  totalSlides: number;
  autoplayActive: boolean;
  progress: number;
  onStepClick?: (stepIndex: number) => void;
}

export function ProgressStrips({ currentSlide, totalSlides, autoplayActive, progress, onStepClick }: ProgressStripsProps) {
  return (
    <div className="space-y-1">
      {/* Step indicator text */}
      <div className="eyebrow-lowercase text-xs text-center">
        Step {currentSlide + 1} of {totalSlides}
      </div>
      
      {/* Progress strips */}
      <div className="flex gap-1">
        {Array.from({ length: totalSlides }, (_, index) => {
          const isPast = index < currentSlide;
          const isCurrent = index === currentSlide;
          const isFuture = index > currentSlide;
          
          return (
            <button
              key={index}
              className={`flex-1 h-2 bg-muted rounded-full overflow-hidden ${
                isPast ? 'cursor-pointer' : 'cursor-default'
              }`}
              onClick={() => isPast && onStepClick?.(index)}
              disabled={!isPast}
              aria-label={`${isPast ? 'Go to step' : 'Step'} ${index + 1}${isCurrent ? ' (current)' : ''}${isFuture ? ' (locked)' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div
                className={`h-full transition-all duration-300 ease-out ${
                  isPast
                    ? 'bg-primary' 
                    : isCurrent 
                      ? 'bg-accent'
                      : 'bg-muted'
                }`}
                style={{
                  width: isPast
                    ? '100%' 
                    : isCurrent 
                      ? `${progress}%`
                      : '0%'
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}