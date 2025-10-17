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
    <div className="flex gap-2 w-full max-w-[200px]">
      {Array.from({ length: totalSlides }, (_, index) => {
        const isPast = index < currentSlide;
        const isCurrent = index === currentSlide;
        const isFuture = index > currentSlide;
        
        return (
          <button
            key={index}
            className={`flex-1 h-2 rounded-md overflow-hidden transition-all ${
              isPast ? 'cursor-pointer bg-primary hover:opacity-80' : 'cursor-default bg-muted/40'
            } ${isCurrent ? 'bg-primary' : ''}`}
            onClick={() => isPast && onStepClick?.(index)}
            disabled={!isPast}
            aria-label={`${isPast ? 'Go to step' : 'Step'} ${index + 1}${isCurrent ? ' (current)' : ''}${isFuture ? ' (locked)' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
            style={{
              opacity: isCurrent ? `${Math.max(0.3, progress / 100)}` : undefined
            }}
          />
        );
      })}
    </div>
  );
}