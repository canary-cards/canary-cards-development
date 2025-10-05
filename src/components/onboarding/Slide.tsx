import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DynamicSvg } from '../DynamicSvg';
import { useIsMobile } from '../../hooks/use-mobile';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  const isMobile = useIsMobile();
  const [isSourceOpen, setIsSourceOpen] = useState(false);
  
  return (
    <div className="relative h-full">
      {/* Icon area - fixed position, always same spot */}
      <div 
        className="absolute inset-x-0 flex items-center justify-center px-6"
        style={{
          top: '5%',
          height: '40%', // Fixed 40% height for icon area, ends at 45%
        }}
      >
        <div 
          className="flex items-center justify-center relative"
          style={{
            width: 'clamp(200px, min(40vw, 35vh), 280px)',
            height: 'clamp(200px, min(40vw, 35vh), 280px)',
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

      {/* Text area - responsive spacing from icon */}
      <div 
        className="px-4 sm:px-6 text-center"
        style={{
          paddingTop: isMobile ? '48vh' : '47vh',
          paddingBottom: 'max(env(safe-area-inset-bottom, 1rem), 2.5rem)',
        }}
      >
        <div className="space-y-4">
          <h2 className="display-title leading-tight">
            {title}
          </h2>
          <h3 className="subtitle text-base leading-relaxed">
            {subtitle}
          </h3>
          {finePrint && (
            <Collapsible open={isSourceOpen} onOpenChange={setIsSourceOpen}>
              <CollapsibleTrigger 
                className="text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-pointer inline-flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                Source
                <ChevronDown 
                  className={`w-3 h-3 transition-transform ${isSourceOpen ? 'rotate-180' : ''}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  {finePrint}
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  );
}