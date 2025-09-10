import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getSourceIcon, getSourceDisplayName } from '@/lib/sourceIcons';
import type { Source } from '@/types';

interface SourceIconProps {
  url: string;
  size?: number;
}

function SourceIcon({ url, size = 20 }: SourceIconProps) {
  const [iconData, setIconData] = useState<{ src?: string; initials: string; color: string } | null>(null);

  useEffect(() => {
    getSourceIcon(url).then(result => {
      setIconData({
        src: result.src,
        initials: result.fallback.initials,
        color: result.fallback.color
      });
    });
  }, [url]);

  if (!iconData) {
    // Loading state - simple gray square
    return (
      <div 
        className="flex items-center justify-center rounded text-xs font-medium bg-muted text-muted-foreground"
        style={{ width: size, height: size }}
      >
        •
      </div>
    );
  }

  if (iconData.src) {
    return (
      <img
        src={iconData.src}
        alt={getSourceDisplayName(url)}
        className="rounded"
        style={{ width: size, height: size }}
        onError={(e) => {
          // Fallback to initials if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          target.nextElementSibling?.classList.remove('hidden');
        }}
      />
    );
  }

  return (
    <div 
      className="flex items-center justify-center rounded text-xs font-semibold text-white"
      style={{ 
        width: size, 
        height: size, 
        backgroundColor: iconData.color 
      }}
    >
      {iconData.initials}
    </div>
  );
}

interface CollapsibleSourcesProps {
  sources: Source[];
}

export function CollapsibleSources({ sources }: CollapsibleSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!sources || sources.length === 0) {
    return null;
  }

  // Deduplicate sources by domain for preview
  const uniqueSources = sources.reduce((acc, source) => {
    const domain = new URL(source.url).hostname;
    if (!acc.find(s => new URL(s.url).hostname === domain)) {
      acc.push(source);
    }
    return acc;
  }, [] as Source[]);
  
  const previewSources = uniqueSources.slice(0, 4);
  const additionalCount = Math.max(0, uniqueSources.length - 4);

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full bg-muted hover:bg-disabled border border-border rounded-lg p-3 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <div className="flex items-center gap-3">
              <ChevronRight 
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? 'rotate-90' : ''
                }`} 
              />
              <span className="eyebrow-lowercase text-muted-foreground">
                Sources from:
              </span>
              <div className="flex items-center gap-2 flex-1">
                <div className="flex gap-1">
                  {previewSources.map((source, index) => (
                    <div key={`${new URL(source.url).hostname}-${index}`} className="flex-shrink-0">
                      <SourceIcon url={source.url} />
                    </div>
                  ))}
                </div>
                {additionalCount > 0 && (
                  <span className="body-text text-muted-foreground text-sm">
                    +{additionalCount} more
                  </span>
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="bg-card border border-t-0 border-border rounded-b-lg p-4 space-y-3 animate-accordion-down">
          {sources.map((source, index) => {
            // Extract article title from description (first sentence or first 100 chars)
            const cleanDescription = source.description.replace(/<[^>]*>/g, '');
            const title = cleanDescription.split('.')[0] || cleanDescription.substring(0, 100);
            
            return (
              <div 
                key={index} 
                className={`flex items-start gap-3 pb-3 ${
                  index < sources.length - 1 ? 'border-b border-border/50' : ''
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <SourceIcon url={source.url} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="body-text text-foreground text-sm font-medium leading-relaxed hover:text-primary transition-colors cursor-pointer underline decoration-1 underline-offset-2"
                  >
                    {title}
                  </a>
                  <div className="text-xs text-muted-foreground">
                    {getSourceDisplayName(source.url)}
                  </div>
                </div>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}