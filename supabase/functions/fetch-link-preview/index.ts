import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

serve(async (req) => {
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

    // Fetch the URL with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0)',
      },
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    
    // Extract Open Graph and meta tags
    const preview: LinkPreview = { url };
    
    // OpenGraph title
    const ogTitle = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const metaTitle = html.match(/<title>([^<]+)<\/title>/i);
    preview.title = ogTitle?.[1] || metaTitle?.[1];
    
    // OpenGraph description
    const ogDesc = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    preview.description = ogDesc?.[1] || metaDesc?.[1];
    
    // OpenGraph image
    const ogImage = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    preview.image = ogImage?.[1];
    
    // OpenGraph site name
    const ogSiteName = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
    preview.siteName = ogSiteName?.[1];

    console.log(`✅ Extracted preview for ${url}:`, preview);

    return new Response(
      JSON.stringify(preview),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching link preview:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to fetch link preview',
        url: (await req.json().catch(() => ({}))).url 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
