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

// Source priority system for better credibility
const getSourcePriority = (url: string): number => {
  const domain = new URL(url).hostname.toLowerCase();
  
  // Government sources (highest priority)
  if (domain.includes('congress.gov') || domain.includes('house.gov') || domain.includes('senate.gov')) {
    return 4;
  }
  
  // Major news agencies
  if (domain.includes('reuters.com') || domain.includes('apnews.com') || domain.includes('bbc.com')) {
    return 3;
  }
  
  // Established newspapers
  if (domain.includes('nytimes.com') || domain.includes('washingtonpost.com') || domain.includes('wsj.com')) {
    return 2;
  }
  
  // Other news sources
  return 1;
};

// Smart title truncation for mobile
const truncateTitle = (title: string, maxWords: number = 8): string => {
  const words = title.split(' ');
  if (words.length <= maxWords) return title;
  return words.slice(0, maxWords).join(' ') + '...';
};

export function CollapsibleSources({ sources }: CollapsibleSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  if (!sources || sources.length === 0) {
    return null;
  }

  // Sort all sources by priority (government > news agencies > newspapers)
  const prioritizedSources = sources
    .sort((a, b) => getSourcePriority(b.url) - getSourcePriority(a.url));
  
  // Get unique domains with their highest priority source
  const uniqueDomains = prioritizedSources.reduce((acc, source) => {
    const domain = new URL(source.url).hostname;
    if (!acc.find(s => new URL(s.url).hostname === domain)) {
      acc.push(source);
    }
    return acc;
  }, [] as Source[]);
  
  // For preview, show up to 3 unique publications
  const previewSources = uniqueDomains.slice(0, 3);
  
  // Count additional unique publications (not articles)
  const additionalCount = Math.max(0, uniqueDomains.length - previewSources.length);

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full bg-white hover:bg-muted/50 border border-primary rounded-xl p-3 sm:p-4 transition-all duration-200 focus:outline-none">
            <div className="flex items-center gap-2 sm:gap-3">
              <ChevronRight 
                className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? 'rotate-90' : ''
                }`} 
              />
              <span className="eyebrow-lowercase text-muted-foreground text-sm">
                Sources from:
              </span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex gap-1.5 flex-shrink-0">
                  {previewSources.map((source, index) => (
                    <div key={`${new URL(source.url).hostname}-${index}`} className="flex-shrink-0">
                      <SourceIcon url={source.url} size={18} />
                    </div>
                  ))}
                </div>
                {additionalCount > 0 && (
                  <span className="body-text text-muted-foreground text-sm whitespace-nowrap">
                    +{additionalCount} more
                  </span>
                )}
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="bg-white border border-t-0 border-primary rounded-b-xl p-3 sm:p-4 space-y-3 animate-accordion-down">
          {prioritizedSources.map((source, index) => {
            // Extract and clean article title
            const cleanDescription = source.description.replace(/<[^>]*>/g, '');
            const rawTitle = cleanDescription.split('.')[0] || cleanDescription.substring(0, 100);
            const title = truncateTitle(rawTitle.trim());
            
            return (
              <div 
                key={index} 
                className={`flex items-start gap-3 pb-3 min-h-[44px] ${
                  index < prioritizedSources.length - 1 ? 'border-b border-border/50' : ''
                }`}
              >
                <div className="flex-shrink-0 mt-1">
                  <SourceIcon url={source.url} size={18} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block body-text text-foreground text-sm font-medium leading-snug hover:text-primary transition-colors underline decoration-1 underline-offset-2 hover:decoration-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-sm"
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