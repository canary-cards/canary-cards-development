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

// HTML entity decoding function
const decodeHtmlEntities = (text: string): string => {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = text;
  return textArea.value;
};

// Better text truncation for summaries
const truncateText = (text: string, maxLength: number = 200): string => {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
};

// Get the best content from source with fallback logic
const getSourceContent = (source: Source): string => {
  // Debug: log the source object to see what data we have
  console.log('Source data:', {
    summary: source.summary,
    headline: source.headline,
    outlet: source.outlet,
    url: source.url
  });
  
  // Priority: headline > summary (since headline is usually more descriptive)
  if (source.headline && source.headline.trim() && source.headline.trim() !== 'Recent developments in this policy area.') {
    return decodeHtmlEntities(source.headline.trim());
  }
  if (source.summary && source.summary.trim() && source.summary.trim() !== 'Recent developments in this policy area.') {
    return decodeHtmlEntities(source.summary.trim());
  }
  
  // If outlet is available, use it as more informative fallback
  if (source.outlet && source.outlet.trim()) {
    return `Recent coverage from ${source.outlet}`;
  }
  
  return 'Recent developments in this policy area.';
};

export function CollapsibleSources({ sources }: CollapsibleSourcesProps) {
  const [isLoading, setIsLoading] = useState(true);
  
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

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <h3 className="field-label">Sources</h3>
      
      <div className="space-y-4">
        {prioritizedSources.map((source, index) => {
          const domain = new URL(source.url).hostname;
          const content = getSourceContent(source);
          const truncatedContent = truncateText(content);
          
          return (
            <div key={index} className="space-y-2">
              <div className="body-text text-sm leading-relaxed text-foreground">
                {truncatedContent}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Source:</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:bg-primary/30 transition-colors"
                  aria-label={`Read full article from ${domain} (opens in new tab)`}
                >
                  {domain}
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}