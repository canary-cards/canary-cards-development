import React from 'react';

interface ProgressStripsProps {
  currentSlide: number;
  totalSlides: number;
  autoplayActive: boolean;
  progress: number;
}

export function ProgressStrips({ currentSlide, totalSlides, autoplayActive, progress }: ProgressStripsProps) {
  return (
    <div className="flex gap-1 px-4 py-2">
      {Array.from({ length: totalSlides }, (_, index) => (
        <div
          key={index}
          className="flex-1 h-2 rounded-full overflow-hidden"
        >
          <div
            className={`h-full transition-all duration-300 ease-out ${
              index < currentSlide 
                ? 'bg-primary' 
                : index === currentSlide 
                  ? 'bg-yellow-500'
                  : 'bg-transparent'
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