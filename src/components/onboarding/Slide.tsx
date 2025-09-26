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
    <div className="h-full flex flex-col">
      {/* Icon section - flexible but with minimum space */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-4">
        <div 
          className="flex items-center justify-center relative max-w-full max-h-full"
          style={{
            width: 'clamp(200px, min(40vw, 40vh), 280px)',
            height: 'clamp(200px, min(40vw, 40vh), 280px)',
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

      {/* Guaranteed spacing between icon and text */}
      <div className="h-8 sm:h-12 flex-shrink-0" />

      {/* Text section - takes remaining space with minimum height */}
      <div className="flex-shrink-0 px-4 sm:px-6 text-center pb-6">
        <div className="space-y-4">
          <h2 className="text-2xl display-title leading-tight">
            {title}
          </h2>
          <h3 className="subtitle text-base leading-relaxed">
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