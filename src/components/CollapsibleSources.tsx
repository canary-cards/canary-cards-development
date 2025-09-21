import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getSourceIcon, getSourceDisplayName } from '@/lib/sourceIcons';
import type { Source } from '@/types';

interface SourceIconProps {
  url: string;
  size?: number;
}

// Loading skeleton component
function SourcesSkeleton() {
  return (
    <div className="space-y-3 pt-4 border-t border-border animate-pulse">
      <div className="w-full bg-muted border border-border rounded-xl p-3 sm:p-4 min-h-[44px]">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-4 h-4 bg-muted-foreground/30 rounded"></div>
          <div className="w-20 h-4 bg-muted-foreground/30 rounded"></div>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-6 h-6 bg-muted-foreground/30 rounded"></div>
            ))}
          </div>
          <div className="w-16 h-4 bg-muted-foreground/30 rounded"></div>
        </div>
      </div>
    </div>
  );
}

function SourceIcon({ url, size = 24 }: SourceIconProps) {
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

// Better title truncation - ensure ellipsis doesn't break mid-word
const truncateTitle = (title: string, maxWords: number = 8): string => {
  const words = title.split(' ').filter(word => word.length > 0);
  if (words.length <= maxWords) return title;
  return words.slice(0, maxWords).join(' ') + '...';
};

export function CollapsibleSources({ sources }: CollapsibleSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Debounce toggle to prevent rapid clicking
  const debouncedToggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);
  
  // Simulate loading state (in real app this would depend on data fetching)
  useEffect(() => {
    if (sources && sources.length > 0) {
      setIsLoading(false);
    }
  }, [sources]);
  
  if (!sources || sources.length === 0) {
    return null;
  }
  
  if (isLoading) {
    return <SourcesSkeleton />;
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
      <Collapsible open={isOpen} onOpenChange={debouncedToggle}>
        <CollapsibleTrigger asChild>
           <button 
             className="w-full min-h-[44px] bg-white hover-safe:bg-primary/10 border border-primary rounded-xl p-3 sm:p-4 transition-all duration-200 focus:outline-none"
             aria-expanded={isOpen}
             aria-label={`${isOpen ? 'Collapse' : 'Expand'} sources (${uniqueDomains.length} sources available)`}
           >
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
                        <SourceIcon url={source.url} size={24} />
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
        
        <CollapsibleContent className="bg-white border border-t-0 border-primary rounded-b-xl p-3 sm:p-4 space-y-3 overflow-hidden">
          {prioritizedSources.map((source, index) => {
            // Use headline as the main title, fallback to cleaned description
            const title = source.headline 
              ? truncateTitle(source.headline.trim())
              : truncateTitle(source.description.replace(/<[^>]*>/g, '').trim());
            
            return (
              <div 
                key={index} 
                 className={`group flex items-start gap-3 pb-3 min-h-[44px] hover-safe:bg-primary/10 rounded-lg p-2 -m-2 transition-all duration-200 ${
                   index < prioritizedSources.length - 1 ? 'border-b border-border/50 mb-3' : ''
                 }`}
                style={{
                  animationDelay: `${index * 50}ms`,
                  animation: isOpen ? 'fade-in 0.3s ease-out forwards' : undefined
                }}
              >
                <div className="flex-shrink-0 mt-1">
                  <SourceIcon url={source.url} size={24} />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <a 
                    href={source.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="group/link flex items-center gap-1.5 body-text text-foreground text-sm font-medium leading-tight hover-safe:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded-sm underline decoration-1 underline-offset-2 hover-safe:decoration-2"
                    aria-label={`Read article: ${title} (opens in new tab)`}
                  >
                    <span className="flex-1">{title}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover/link:text-primary transition-colors flex-shrink-0" />
                  </a>
                  <div className="text-xs text-muted-foreground/80 font-medium">
                    {new URL(source.url).hostname}
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