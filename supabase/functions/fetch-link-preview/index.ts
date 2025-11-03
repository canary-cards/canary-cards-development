import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decodeHtmlEntities } from '../_shared/decodeHtmlEntities.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  siteName?: string;
  favicon?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching link preview for: ${url}`);

    // Fetch the page with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // Extract meta tags using regex (lightweight alternative to parsing)
    const extractMetaTag = (property: string): string | undefined => {
      const ogRegex = new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`, 'i');
      const nameRegex = new RegExp(`<meta\\s+name=["']${property}["']\\s+content=["']([^"']+)["']`, 'i');
      
      const ogMatch = html.match(ogRegex);
      if (ogMatch) return decodeHtmlEntities(ogMatch[1]);
      
      const nameMatch = html.match(nameRegex);
      if (nameMatch) return decodeHtmlEntities(nameMatch[1]);
      
      return undefined;
    };

    // Extract title from <title> tag
    const extractTitle = (): string | undefined => {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch?.[1]) {
        const decodedTitle = decodeHtmlEntities(titleMatch[1]);
        return decodedTitle
          .replace(/\s+/g, ' ')
          .trim();
      }
      return undefined;
    };

    // Extract favicon
    const extractFavicon = (): string | undefined => {
      const faviconRegex = /<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i;
      const match = html.match(faviconRegex);
      if (match?.[1]) {
        const faviconUrl = match[1];
        // Handle relative URLs
        if (faviconUrl.startsWith('//')) return `https:${faviconUrl}`;
        if (faviconUrl.startsWith('/')) return `https://${domain}${faviconUrl}`;
        if (faviconUrl.startsWith('http')) return faviconUrl;
        return `https://${domain}/${faviconUrl}`;
      }
      // Default favicon location
      return `https://${domain}/favicon.ico`;
    };

    const preview: LinkPreview = {
      url,
      title: extractMetaTag('og:title') || extractMetaTag('twitter:title') || extractTitle(),
      description: extractMetaTag('og:description') || extractMetaTag('twitter:description') || extractMetaTag('description'),
      siteName: extractMetaTag('og:site_name'),
      favicon: extractFavicon()
    };

    console.log(`Successfully extracted preview for ${url}:`, {
      hasTitle: !!preview.title,
      hasDescription: !!preview.description,
      hasSiteName: !!preview.siteName
    });

    return new Response(
      JSON.stringify(preview),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Link preview error:', error);
    
    const errorResponse: LinkPreview = {
      url: '',
      error: error.message || 'Failed to fetch link preview'
    };

    return new Response(
      JSON.stringify(errorResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
