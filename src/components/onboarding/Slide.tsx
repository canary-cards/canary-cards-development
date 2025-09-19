import React from 'react';
import { DynamicSvg } from '../DynamicSvg';

interface SlideProps {
  title: string;
  subtitle: string;
  finePrint?: string;
  iconPlaceholder: string;
  assetName?: string;
  imageAlt?: string;
  currentSlide: number;
  allAssets: Array<{ assetName: string; alt: string; }>;
}

export function Slide({ title, subtitle, finePrint, iconPlaceholder, assetName, imageAlt, currentSlide, allAssets }: SlideProps) {
  return (
    <div className="relative h-full">
      {/* Icon area - responsive height based on screen aspect ratio */}
      <div 
        className="absolute top-0 left-0 right-0 flex items-center justify-center px-6"
        style={{
          height: 'clamp(50%, calc(60% - 2rem), 70%)', // More flexible range
        }}
      >
        <div 
          className="flex items-center justify-center relative"
          style={{
            width: 'clamp(200px, min(50vw, 50vh), 300px)', // Better responsive sizing
            height: 'clamp(200px, min(50vw, 50vh), 300px)',
          }}
        >
          {/* Render all SVGs at once for smooth transitions */}
          {allAssets.map((asset, index) => (
            <div
              key={index}
              className={`absolute inset-0 w-full h-full transition-[opacity,transform] duration-200 ease-in-out motion-reduce:transition-none motion-reduce:transform-none pointer-events-none select-none ${
                index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              style={{ 
                willChange: 'opacity, transform',
                transform: index === currentSlide && currentSlide === 1 ? 'scale(0.85)' : undefined
              }}
            >
              <DynamicSvg 
                assetName={asset.assetName}
                alt={asset.alt}
                className="w-full h-full object-contain"
              />
            </div>
          ))}
          {!assetName && (
            <span className="text-xs font-medium text-muted-foreground text-center px-2">
              {iconPlaceholder}
            </span>
          )}
        </div>
      </div>

      {/* Responsive text area */}
      <div 
        className="absolute left-0 right-0 px-4 sm:px-6 text-center"
        style={{
          top: 'clamp(50%, calc(60% - 2rem), 70%)', // Matches icon area
          bottom: 'max(env(safe-area-inset-bottom, 0px), 1.5rem)',
          overflow: 'hidden', // Prevent text overflow
        }}
      >
        <div className="space-y-2 sm:space-y-4 max-h-full">
          <h2 className="display-title text-xl sm:text-2xl md:text-3xl leading-tight">
            {title}
          </h2>
          <h3 className="subtitle text-sm sm:text-base leading-relaxed">
            {subtitle}
          </h3>
          {finePrint && (
            <p className="text-xs text-muted-foreground/70 mt-4 sm:mt-6">
              {finePrint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}