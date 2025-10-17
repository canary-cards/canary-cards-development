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
    <div className="w-full">
      {/* Progress strips */}
      <div className="flex gap-1 w-full">
        {Array.from({ length: totalSlides }, (_, index) => {
          const isPast = index < currentSlide;
          const isCurrent = index === currentSlide;
          const isFuture = index > currentSlide;
          
          return (
            <button
              key={index}
              className={`flex-1 h-1.5 bg-muted/30 rounded-full overflow-hidden ${
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
                      ? 'bg-primary'
                      : 'bg-muted/30'
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