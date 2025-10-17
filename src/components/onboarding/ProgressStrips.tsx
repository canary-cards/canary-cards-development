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
    <div className="flex gap-2 w-full">
      {Array.from({ length: totalSlides }, (_, index) => {
        const isPast = index < currentSlide;
        const isCurrent = index === currentSlide;
        const isFuture = index > currentSlide;
        
        return (
          <button
            key={index}
            className={`flex-1 h-1 rounded-full overflow-hidden transition-all ${
              isPast ? 'cursor-pointer' : 'cursor-default'
            }`}
            onClick={() => isPast && onStepClick?.(index)}
            disabled={!isPast}
            aria-label={`${isPast ? 'Go to step' : 'Step'} ${index + 1}${isCurrent ? ' (current)' : ''}${isFuture ? ' (locked)' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
            style={{
              backgroundColor: isPast ? 'hsl(var(--primary))' : isCurrent ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
              opacity: isCurrent ? `${Math.max(0.4, progress / 100)}` : isPast ? 1 : 0.3
            }}
          />
        );
      })}
    </div>
  );
}