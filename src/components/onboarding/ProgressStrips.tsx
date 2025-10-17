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
    <div className="flex w-full gap-2 items-center">
      {Array.from({ length: totalSlides }, (_, index) => {
        const isPast = index < currentSlide;
        const isCurrent = index === currentSlide;
        const isFuture = index > currentSlide;
        
        return (
          <button
            key={index}
            className={`flex-1 min-h-0 h-2 p-0 m-0 bg-transparent rounded-full overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isPast ? 'cursor-pointer' : 'cursor-default'
            }`}
            onClick={() => isPast && onStepClick?.(index)}
            disabled={!isPast}
            aria-label={`${isPast ? 'Go to step' : 'Step'} ${index + 1}${isCurrent ? ' (current)' : ''}${isFuture ? ' (locked)' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <div className={`h-full w-full rounded-full transition-colors ${
              isFuture ? 'bg-muted' : isCurrent ? 'bg-muted' : 'bg-transparent'
            }`}>
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isPast ? 'bg-primary' : isCurrent ? 'bg-accent' : 'bg-transparent'
                }`}
                style={{ 
                  width: isPast ? '100%' : isCurrent ? (autoplayActive ? `${progress}%` : '100%') : '0%',
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}