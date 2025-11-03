import React from 'react';

interface ProgressStripsProps {
  currentSlide: number;
  totalSlides: number;
  autoplayActive: boolean;
  progress: number;
  onSlideClick?: (slideIndex: number, source: string) => void;
}

export function ProgressStrips({ 
  currentSlide, 
  totalSlides, 
  autoplayActive, 
  progress,
  onSlideClick 
}: ProgressStripsProps) {
  const handleStripClick = (index: number) => {
    // Only allow clicking on past slides
    if (index < currentSlide && onSlideClick) {
      onSlideClick(index, 'progress_strip');
    }
  };

  return (
    <div className="flex gap-1 py-2">
      {Array.from({ length: totalSlides }, (_, index) => {
        const isPast = index < currentSlide;
        const isCurrent = index === currentSlide;
        const isFuture = index > currentSlide;

        return (
          <div
            key={index}
            className={`flex-1 h-2 bg-muted rounded-full overflow-hidden ${
              isPast ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
            }`}
            onClick={() => handleStripClick(index)}
            role={isPast ? 'button' : undefined}
            aria-label={isPast ? `Go to slide ${index + 1}` : undefined}
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
          </div>
        );
      })}
    </div>
  );
}