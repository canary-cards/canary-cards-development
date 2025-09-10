// Source icon utilities for fetching favicons and fallback icons

interface SourceIconResult {
  src?: string;
  fallback: {
    initials: string;
    color: string;
  };
}

// Publication color mapping using existing design system colors
const PUBLICATION_COLORS: Record<string, string> = {
  'nytimes.com': 'hsl(var(--primary))', // Uses existing primary color
  'theguardian.com': 'hsl(var(--primary))', // Uses existing primary color
  'congress.gov': 'hsl(var(--primary))', // Uses existing primary color
  'house.gov': 'hsl(var(--primary))', // Uses existing primary color
  'senate.gov': 'hsl(var(--primary))', // Uses existing primary color
  'wikipedia.org': 'hsl(var(--muted-foreground))', // Uses existing muted color
  'default': 'hsl(var(--muted-foreground))' // Default fallback color
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

// Get favicon URLs for a domain (try multiple sources)
function getFaviconUrls(domain: string): string[] {
  return [
    `https://${domain}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`
  ];
}

// Check multiple favicon URLs until one works
async function findWorkingFavicon(urls: string[]): Promise<string | null> {
  for (const url of urls) {
    try {
      const response = await Promise.race([
        fetch(url, { method: 'HEAD' }),
        new Promise<Response>((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 1000)
        )
      ]);
      if (response.ok) {
        return url;
      }
    } catch {
      // Try next URL
    }
  }
  return null;
}

// Main function to get source icon information
export async function getSourceIcon(sourceUrl: string): Promise<SourceIconResult> {
  const { domain, initials } = getPublicationInfo(sourceUrl);
  const faviconUrls = getFaviconUrls(domain);
  
  const color = PUBLICATION_COLORS[domain] || PUBLICATION_COLORS.default;
  
  const result: SourceIconResult = {
    fallback: { initials, color }
  };

  // Try to find a working favicon from multiple sources
  try {
    const workingFavicon = await findWorkingFavicon(faviconUrls);
    if (workingFavicon) {
      result.src = workingFavicon;
    }
  } catch {
    // Use fallback if favicon check fails
  }

  return result;
}

// Get display name for a source URL
export function getSourceDisplayName(url: string): string {
  const { name } = getPublicationInfo(url);
  return name;
}