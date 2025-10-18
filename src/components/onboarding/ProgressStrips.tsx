import React from 'react';

interface ProgressStripsProps {
  currentSlide: number;
  totalSlides: number;
  autoplayActive: boolean;
  progress: number;
}

export function ProgressStrips({ currentSlide, totalSlides, autoplayActive, progress }: ProgressStripsProps) {
  return (
    <div className="flex gap-1 py-2">
      {Array.from({ length: totalSlides }, (_, index) => (
        <div
          key={index}
          className="flex-1 h-2 bg-muted rounded-full overflow-hidden"
        >
          <div
            className={`h-full transition-all duration-300 ease-out ${
              index < currentSlide 
                ? 'bg-primary' 
                : index === currentSlide 
                  ? 'bg-accent'
                  : 'bg-muted'
            }`}
            style={{
              width: index < currentSlide 
                ? '100%' 
                : index === currentSlide 
                  ? `${progress}%`
                  : '0%'
            }}
          />
        </div>
      ))}
    </div>
  );
}