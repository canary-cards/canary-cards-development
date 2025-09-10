// Source icon utilities for fetching favicons and fallback icons

interface SourceIconResult {
  src?: string;
  fallback: {
    initials: string;
    color: string;
  };
}

// Publication color and icon mapping with design system colors
const PUBLICATION_INFO: Record<string, { color: string; icon?: string }> = {
  // Government sources (highest credibility)
  'congress.gov': { color: 'hsl(221, 39%, 11%)', icon: 'https://www.congress.gov/img/favicon.ico' },
  'house.gov': { color: 'hsl(221, 39%, 11%)' },
  'senate.gov': { color: 'hsl(221, 39%, 11%)' },
  
  // Major news agencies
  'reuters.com': { color: 'hsl(15, 85%, 50%)' },
  'apnews.com': { color: 'hsl(0, 60%, 50%)' },
  'bbc.com': { color: 'hsl(0, 0%, 0%)' },
  'bbc.co.uk': { color: 'hsl(0, 0%, 0%)' },
  
  // Established newspapers
  'nytimes.com': { color: 'hsl(0, 0%, 0%)' },
  'washingtonpost.com': { color: 'hsl(0, 0%, 0%)' },
  'wsj.com': { color: 'hsl(0, 0%, 0%)' },
  'theguardian.com': { color: 'hsl(207, 90%, 24%)' },
  'ft.com': { color: 'hsl(339, 89%, 49%)' },
  
  // Other news sources
  'cnn.com': { color: 'hsl(0, 100%, 40%)' },
  'foxnews.com': { color: 'hsl(0, 60%, 50%)' },
  'npr.org': { color: 'hsl(213, 100%, 40%)' },
  'politico.com': { color: 'hsl(0, 85%, 55%)' },
  'thehill.com': { color: 'hsl(210, 100%, 25%)' },
  
  // Reference sources
  'wikipedia.org': { color: 'hsl(0, 0%, 20%)' },
  
  'default': { color: 'hsl(var(--muted-foreground))' }
};

// Extract domain and get publication info
function getPublicationInfo(url: string): { domain: string; name: string; initials: string } {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    
    // Map common domains to readable names and initials
    const domainMappings: Record<string, { name: string; initials: string }> = {
      'nytimes.com': { name: 'New York Times', initials: 'NYT' },
      'theguardian.com': { name: 'The Guardian', initials: 'TG' },
      'congress.gov': { name: 'Congress.gov', initials: 'CG' },
      'house.gov': { name: 'House.gov', initials: 'HG' },
      'senate.gov': { name: 'Senate.gov', initials: 'SG' },
      'wikipedia.org': { name: 'Wikipedia', initials: 'W' },
      'immigrationforum.org': { name: 'Immigration Forum', initials: 'IF' }
    };

    const mapping = domainMappings[domain];
    if (mapping) {
      return { domain, name: mapping.name, initials: mapping.initials };
    }

    // Generate initials from domain
    const parts = domain.split('.');
    const mainPart = parts[0] || domain;
    const initials = mainPart.slice(0, 2).toUpperCase();

    return { 
      domain, 
      name: domain.charAt(0).toUpperCase() + domain.slice(1), 
      initials 
    };
  } catch {
    return { domain: '', name: 'Source', initials: 'S' };
  }
}

// Simple favicon service that works reliably
function getFaviconUrl(domain: string): string {
  // Using DuckDuckGo's favicon service which has better CORS support
  return `https://external-content.duckduckgo.com/ip3/${domain}.ico`;
}

// Main function to get source icon information
export async function getSourceIcon(sourceUrl: string): Promise<SourceIconResult> {
  const { domain, initials } = getPublicationInfo(sourceUrl);
  const pubInfo = PUBLICATION_INFO[domain] || PUBLICATION_INFO.default;
  
  const result: SourceIconResult = {
    fallback: { initials, color: pubInfo.color }
  };

  // Try DuckDuckGo's favicon service (better CORS support)
  try {
    const faviconUrl = getFaviconUrl(domain);
    // Don't do a HEAD check since it might fail due to CORS, just try to use it
    result.src = faviconUrl;
  } catch {
    // Use fallback initials with publication colors
  }

  return result;
}

// Get display name for a source URL
export function getSourceDisplayName(url: string): string {
  const { name } = getPublicationInfo(url);
  return name;
}