import React, { useState, useEffect, useCallback } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getSourceIcon, getSourceDisplayName } from '@/lib/sourceIcons';
import { supabase } from '@/integrations/supabase/client';
import type { Source } from '@/types';

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface EnhancedSource extends Source {
  preview?: LinkPreview;
  previewLoading?: boolean;
}

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
  const [enhancedSources, setEnhancedSources] = useState<EnhancedSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch link previews for all sources
  useEffect(() => {
    if (!sources || sources.length === 0) {
      setIsLoading(false);
      return;
    }

    const fetchLinkPreviews = async () => {
      // Initialize with original sources
      const initialSources: EnhancedSource[] = sources.map(s => ({ 
        ...s, 
        previewLoading: true 
      }));
      setEnhancedSources(initialSources);
      setIsLoading(false);

      // Fetch all previews in parallel
      const previewPromises = sources.map(async (source, index) => {
        try {
          const { data, error } = await supabase.functions.invoke('fetch-link-preview', {
            body: { url: source.url }
          });

          if (error) throw error;

          return { index, preview: data as LinkPreview };
        } catch (error) {
          console.error(`Failed to fetch preview for ${source.url}:`, error);
          return { index, preview: null };
        }
      });

      const results = await Promise.allSettled(previewPromises);
      
      // Update sources with previews
      setEnhancedSources(prev => {
        const updated = [...prev];
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.preview) {
            updated[result.value.index] = {
              ...updated[result.value.index],
              preview: result.value.preview,
              previewLoading: false
            };
          } else if (result.status === 'fulfilled') {
            updated[result.value.index] = {
              ...updated[result.value.index],
              previewLoading: false
            };
          }
        });
        return updated;
      });
    };

    fetchLinkPreviews();
  }, [sources]);
  
  if (!sources || sources.length === 0) {
    return null;
  }
  
  if (isLoading) {
    return <SourcesSkeleton />;
  }

  // Sort all sources by priority (government > news agencies > newspapers)
  const prioritizedSources = enhancedSources
    .sort((a, b) => getSourcePriority(b.url) - getSourcePriority(a.url));

  return (
    <div className="space-y-3 pt-4 border-t border-border">
      <h3 className="field-label">Sources</h3>
      
      <div className="space-y-4">
        {prioritizedSources.map((source, index) => {
          const domain = new URL(source.url).hostname;
          
          // Use link preview data if available, fallback to original data
          const title = source.preview?.title || source.headline;
          const description = source.preview?.description || source.description;
          const summaryText = title?.trim() || description.replace(/<[^>]*>/g, '').trim();
          
          return (
            <div key={index} className="space-y-2">
              <div className="body-text text-sm leading-relaxed">
                {source.previewLoading ? (
                  <span className="inline-block animate-pulse">Loading preview...</span>
                ) : (
                  <>
                    {summaryText}{' '}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block align-baseline text-sm font-medium leading-tight px-2.5 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:bg-primary/30 transition-colors"
                      aria-label={`Read source from ${domain} (opens in new tab)`}
                    >
                      {source.preview?.siteName || domain}
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}