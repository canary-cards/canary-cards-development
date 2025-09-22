import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface Source {
  url: string;
  outlet: string;
  summary: string;
  headline: string;
}

interface ThemeAnalysis {
  primaryTheme: string;
  urgencyKeywords: string[];
  localAngle: string;
  searchTerms: string[];
  confidence: number;
  reasoning: string;
}

// API key management for Deno environment
function getApiKey(envVar: string, fallback?: string): string {
  // Prefer environment secrets; do NOT use hardcoded keys
  if (typeof globalThis.Deno !== 'undefined' && globalThis.Deno.env) {
    try {
      const val = globalThis.Deno.env.get(envVar);
      if (val) return val;
    } catch {}
  }
  if (fallback) return fallback;
  throw new Error(`Missing required API key: ${envVar}`);
}

async function getLocationFromZip(zipCode: string): Promise<{ state: string; city: string; region: string }> {
  // Fallback for common zip codes to avoid API calls
  const commonZipMap: { [key: string]: { state: string; city: string; region: string } } = {
    '90210': { state: 'California', city: 'Beverly Hills', region: 'Los Angeles County' },
    '10001': { state: 'New York', city: 'New York', region: 'Manhattan' },
    '78701': { state: 'Texas', city: 'Austin', region: 'Central Texas' },
    '60601': { state: 'Illinois', city: 'Chicago', region: 'Cook County' },
    '98101': { state: 'Washington', city: 'Seattle', region: 'King County' },
    '33101': { state: 'Florida', city: 'Miami', region: 'Miami-Dade County' },
    '85001': { state: 'Arizona', city: 'Phoenix', region: 'Phoenix Metro' },
    '97201': { state: 'Oregon', city: 'Portland', region: 'Portland Metro' },
    '30309': { state: 'Georgia', city: 'Atlanta', region: 'Metro Atlanta' },
    '80202': { state: 'Colorado', city: 'Denver', region: 'Denver Metro' }
  };
  
  // Check common zip codes first
  if (commonZipMap[zipCode]) {
    return commonZipMap[zipCode];
  }
  
  // Use Geocodio API for other zip codes
  try {
    const geocodioApiKey = getApiKey('GEOCODIO_KEY');
    const response = await fetch(
      `https://api.geocod.io/v1.9/geocode?q=${zipCode}&fields=cd&api_key=${geocodioApiKey}`
    );
    
    if (!response.ok) {
      throw new Error(`Geocodio API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      throw new Error('No results found for zip code');
    }
    
    const result = data.results[0];
    const addressComponents = result.address_components;
    
    return {
      state: addressComponents.state || 'Unknown',
      city: addressComponents.city || 'Unknown',
      region: `${addressComponents.city}, ${addressComponents.state}` || 'Unknown'
    };
    
  } catch (error) {
    console.error(`Geocodio lookup failed for ${zipCode}:`, error);
    // Fallback to unknown values if API fails
    return { state: 'Unknown', city: 'Unknown', region: 'Unknown' };
  }
}

async function analyzeTheme({ concerns, personalImpact, zipCode }: {
  concerns: string,
  personalImpact: string,
  zipCode: string
}): Promise<ThemeAnalysis> {
  const apiKey = getApiKey('anthropickey');
  const location = await getLocationFromZip(zipCode);
  
  const THEME_ANALYZER_PROMPT = `
You are analyzing user concerns to identify the SINGLE most important theme for a congressional postcard.

Your job:
1. Identify ONE primary theme (not multiple themes)
2. Extract 2-3 urgency keywords that convey emotion
3. Suggest local angle for their zip code area
4. Generate 3-4 search terms for finding relevant sources
5. Rate confidence 1-10

Return ONLY valid JSON in this exact format:
{
  "primaryTheme": "specific theme like 'prescription drug costs' or 'housing affordability'",
  "urgencyKeywords": ["keyword1", "keyword2", "keyword3"],
  "localAngle": "how this affects their local area specifically",
  "searchTerms": ["term1", "term2", "term3", "term4"],
  "confidence": 8,
  "reasoning": "why this is the most important theme"
}
`;

  const userMessage = `
CONCERNS: ${concerns}
PERSONAL IMPACT: ${personalImpact || 'Not specified'}
LOCATION: ${location.city}, ${location.state} (${location.region})

Find the ONE most important theme and how it affects ${location.city}, ${location.state} specifically.
`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.1,
      system: THEME_ANALYZER_PROMPT,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  const result = await response.json();
  const analysisText = result.content[0]?.text?.trim() || '';
  
  const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No valid JSON found in analysis response');
  }

  return JSON.parse(jsonMatch[0]);
}

async function discoverSources(themeAnalysis: ThemeAnalysis, zipCode: string): Promise<Source[]> {
  const apiKey = getApiKey('perplexitykey');
  const location = await getLocationFromZip(zipCode);
  
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `You are a news research assistant specializing in local and state-level political news. When you cite sources, you MUST format each citation exactly like this:

**ARTICLE TITLE:** [The exact headline from the original article]
**OUTLET:** [Publication name like "The Sacramento Bee" or "CNN"]
**SUMMARY:** [Key points in 1-2 sentences]

CONTENT TYPE REQUIREMENTS:
- ONLY return: news articles, government reports, policy analysis pieces, and official government announcements
- STRICTLY EXCLUDE: All video content (YouTube, Vimeo, news videos, documentaries), PDFs, social media posts, academic papers, podcasts, and multimedia content
- PRIORITIZE: Local newspapers > State publications > Government sources > National news with local angles

Be extremely precise with article titles - use the actual headline, not a description or URL fragment. Always include the exact title that appears on the original article.`
        },
        {
          role: 'user',
          content: `Find 3-4 recent news articles about "${themeAnalysis.primaryTheme}" affecting ${location.city}, ${location.state} or ${location.state} state.

SOURCE DIVERSITY REQUIREMENT:
- MAXIMUM 1 article per publication/outlet
- Select from DIFFERENT publications to ensure varied perspectives
- MUST include at least 1 high-quality national newspaper when available
- Avoid multiple articles from the same news organization

PRIORITIZATION ORDER (search for a balanced mix):
1. LOCAL: ${location.city} newspapers, local TV news websites, city government sites
2. STATE: ${location.state} state newspapers, state government announcements, state agency reports
3. NATIONAL QUALITY SOURCES: Include at least 1 from trusted "kitchen table" political newspapers:
   - The New York Times, The Guardian, Washington Post, Wall Street Journal, Associated Press, Reuters
   - These provide important national context and credibility - include even if no direct local angle
4. REGIONAL: Regional publications covering ${location.state} if needed to fill remaining slots

REQUIRED CONTENT TYPES:
- News articles from established publications
- Government reports and official announcements
- Policy analysis pieces
- Legislative updates

For each source you cite, provide:
**ARTICLE TITLE:** [Write the EXACT headline from the article - not a summary or description]  
**OUTLET:** [Full publication name]
**SUMMARY:** [Key details about ${themeAnalysis.primaryTheme} in ${location.state}]

Focus on news from the last 30 days. I need the actual article headlines, not generic descriptions.`
        }
      ],
      max_tokens: 800,
      temperature: 0.1,
      return_citations: true,
      search_recency_filter: 'month'
    })
  });

  const result = await response.json();
  const searchContent = result.choices[0]?.message?.content || '';
  const citations = result.citations || [];

  // Helper: fetch the actual page title for a URL (og:title > twitter:title > <title>)
  const fetchPageTitle = async (targetUrl: string): Promise<string | null> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (LovableBot)' }
      });
      clearTimeout(timeoutId);
      if (!res.ok) return null;
      const html = await res.text();
      const snippet = html.slice(0, 100000);
      const og = snippet.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
        || snippet.match(/<meta[^>]+name=["']og:title["'][^>]+content=["']([^"']+)["']/i);
      const tw = snippet.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
      const tt = snippet.match(/<title[^>]*>([^<]+)<\/title>/i);
      let title = og?.[1] || tw?.[1] || tt?.[1];
      if (title) {
        title = title
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&mdash;/g, '—')
          .replace(/&ndash;/g, '–')
          .replace(/\s+/g, ' ')
          .trim();
        return title.substring(0, 200);
      }
    } catch (err) {
      console.log('fetchPageTitle error:', targetUrl, err?.message || err);
    }
    return null;
  };

  const sources: Source[] = [];

  for (const citationUrl of citations as string[]) {
    const url = citationUrl as string;
    
    // Filter out aggregation/listing pages
    const urlLower = url.toLowerCase();
    if (
      urlLower.includes('/tag/') || 
      urlLower.includes('/tags/') ||
      urlLower.includes('/category/') ||
      urlLower.includes('/categories/') ||
      urlLower.includes('/archive/') ||
      urlLower.includes('/search/') ||
      urlLower.includes('/latest-') ||
      urlLower.includes('-news/') ||
      urlLower.includes('today-latest-updates') ||
      /\/\d+\/?$/.test(url) || // URLs ending with numbers (pagination)
      urlLower.includes('/topics/') ||
      urlLower.includes('/feeds/') ||
      urlLower.includes('/rss/')
    ) {
      console.log('Filtered out aggregation page:', url);
      continue;
    }
    
    const urlIndex = searchContent.indexOf(url);

    // 1) Try to fetch the real page title directly (most reliable)
    let headline = (await fetchPageTitle(url)) || '';

    // 2) If unavailable, try to parse from Perplexity text near the URL
    if (!headline && urlIndex !== -1) {
      const marker = '**ARTICLE TITLE:**';
      const lastTitleIdx = searchContent.lastIndexOf(marker, urlIndex);
      if (lastTitleIdx !== -1 && (urlIndex - lastTitleIdx) < 300) {
        const afterTitle = searchContent.substring(lastTitleIdx + marker.length, urlIndex);
        const firstLine = afterTitle.split(/\r?\n/)[0].trim();
        if (firstLine) headline = firstLine.replace(/^[*-]\s*/, '').trim();
      }
      if (!headline) {
        const before = searchContent.substring(Math.max(0, urlIndex - 400), urlIndex);
        const lines = before.split(/\n/).map(l => l.trim()).filter(Boolean);
        const titleLine = [...lines].reverse().find(l => /(\*\*ARTICLE TITLE:\*\*|\*\*TITLE:\*\*|^TITLE:|^Title:)/i.test(l));
        if (titleLine) {
          const cleaned = titleLine.replace(/\*\*/g, '');
          const m = cleaned.match(/(?:ARTICLE TITLE:|TITLE:)\s*(.+)/i);
          if (m) headline = m[1].trim();
        }
        // Ultra-fallback: previous non-empty line as title
        if (!headline && lines.length) {
          headline = lines[lines.length - 1].replace(/^[\-*\d.]+\s*/, '').trim();
        }
      }
    }

    // 3) Domain-based fallback if still missing
    if (!headline) {
      const domain = new URL(url).hostname.replace('www.', '');
      if (domain.includes('congress.gov')) headline = 'Congressional Information';
      else if (domain.includes('census.gov')) headline = 'Census Data and Statistics';
      else if (domain.includes('bls.gov')) headline = 'Bureau of Labor Statistics Report';
      else if (domain.includes('youtube.com')) headline = 'Video Content';
      else if (domain.includes('rentcafe.com')) headline = 'Cost of Living Analysis';
      else if (domain.includes('oysterlink.com')) headline = 'Local Economic Data';
      else if (domain.includes('.gov')) headline = 'Government Report';
      else if (/(news|times|post)/i.test(domain)) headline = 'News Article';
      else headline = `${themeAnalysis.primaryTheme.replace(/\b\w/g, l => l.toUpperCase())} Information`;
    }

    // Outlet from URL
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const outlet = domain.split('.')[0].replace(/\b\w/g, l => l.toUpperCase());

    // Summary extraction near URL
    let summary = '';
    if (urlIndex !== -1) {
      const beforeUrl = searchContent.substring(Math.max(0, urlIndex - 500), urlIndex);
      const afterUrl = searchContent.substring(urlIndex, Math.min(searchContent.length, urlIndex + 500));
      const summaryMatch = (beforeUrl + afterUrl).match(/\*\*SUMMARY:\*\*\s*([^*\n]+)/i);
      if (summaryMatch) {
        summary = summaryMatch[1].trim();
      } else {
        const contextSentences = (beforeUrl + afterUrl).split(/[.!?]+/);
        let meaningful = contextSentences.filter(s => s.length > 30 && s.length < 300 &&
          !/Here are recent|\*\*ARTICLE TITLE:\*\*|\*\*OUTLET:\*\*|Find recent/i.test(s));
        let best = meaningful.find(s => s.toLowerCase().includes(themeAnalysis.primaryTheme.toLowerCase()) ||
          themeAnalysis.urgencyKeywords.some(k => s.toLowerCase().includes(k.toLowerCase())));
        if (!best && meaningful.length) best = meaningful[0];
        if (best) summary = best.trim();
      }
    }
    if (!summary) summary = 'Recent developments in this policy area.';

    sources.push({
      url,
      outlet,
      summary: summary.substring(0, 250) + (summary.length > 250 ? '...' : ''),
      headline
    });
  }
  
  return sources.slice(0, 4); // Return top 4 sources
}

async function draftPostcard({ concerns, personalImpact, zipCode, themeAnalysis, sources, representative }: {
  concerns: string,
  personalImpact: string,
  zipCode: string,
  themeAnalysis: ThemeAnalysis,
  sources: Source[],
  representative: any
}): Promise<string> {
  const apiKey = getApiKey('anthropickey');
  const location = await getLocationFromZip(zipCode);
  
  const POSTCARD_SYSTEM_PROMPT = `Write a congressional postcard that sounds like a real person, not a political speech.

EXACT FORMAT REQUIREMENTS (NON-NEGOTIABLE):
[content - start directly with the message, no salutation or "Dear Rep." or "Rep. Name,"]

NO SALUTATION RULE:
- DO NOT start with "Rep. Name," or "Dear Rep." or any greeting
- Start directly with your message content
- DO NOT end with "Sincerely, [name]" or any signature line
- Keep the message focused and direct

🚨 ABSOLUTE LENGTH RULE (DO NOT BREAK):
- HARD MAXIMUM: 300 characters (including newlines). THIS IS A NON-NEGOTIABLE, CRITICAL REQUIREMENT.
- If your draft is even 1 character over, it will be rejected and not sent. DO NOT EXCEED 300 CHARACTERS UNDER ANY CIRCUMSTANCES.
- TARGET: 275-280 characters (optimal space utilization)
- Character counting includes newlines

TONE & STYLE (CRITICAL FOR AUTHENTICITY):
- Use everyday conversational language with contractions ("can't", "won't", "we're")
- Express genuine emotion but stay factual - think "concerned neighbor"
- Avoid formal political terms

SOURCE INTEGRATION:
- Reference relevant bills as "H.R. [NUMBER]" when appropriate
- Use recent developments to add urgency
- Connect national news to local impact
- Only use sources that genuinely relate to the concern

Write the complete postcard following these guidelines exactly. If you are unsure, it is better to be short than to go over the limit. Never exceed 300 characters.`;

  const today = new Date().toISOString().split('T')[0];
  const context = `
Today's date: ${today}
User concern: ${concerns}
Personal impact: ${personalImpact || ''}
Location: ${location.city}, ${location.state}
Representative: ${representative.name} (${representative.party}, ${representative.type})
Theme analysis: ${JSON.stringify(themeAnalysis, null, 2)}
Selected sources:
${sources.map((s, i) => `  ${i+1}. Title: ${s.url.split('/').pop()?.replace(/-/g, ' ') || 'Article'}
     Outlet: ${s.outlet}
     Summary: ${s.summary}
     URL: ${s.url}`).join('\n')}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      temperature: 0.1,
      system: POSTCARD_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: context }]
    })
  });

  const result = await response.json();
  const text = result.content[0]?.text?.trim() || '';
  
  return text;
}

async function shortenPostcard(originalPostcard: string, concerns: string, personalImpact: string, zipCode: string): Promise<string> {
  const apiKey = getApiKey('anthropickey');
  const location = await getLocationFromZip(zipCode);
  
  const SHORTENING_PROMPT = `You are an expert at shortening congressional postcards while maintaining their impact and authenticity.

TASK: Shorten this postcard to under 300 characters while keeping it excellent.

STRATEGY:
- If the postcard makes multiple points, choose the STRONGEST one and focus on it
- Remove secondary arguments - don't try to cram everything in
- Keep the personal connection and emotional impact
- Maintain the authentic voice and conversational tone
- Include a call to action 
- NO salutation or signature - start directly with the message content

FORMAT REQUIREMENTS:
- DO NOT start with "Rep. Name," or "Dear Rep." or any greeting
- Start directly with your message content  
- DO NOT end with "Sincerely, [name]" or any signature line
- Keep the message focused and direct

QUALITY STANDARDS:
- The shortened version should be a complete, compelling postcard on its own
- Better to make one point well than multiple points poorly
- Keep contractions and natural language
- Don't sacrifice authenticity for brevity

ABSOLUTE REQUIREMENTS:
- Must be under 300 characters (including newlines)
- No salutation, no signature - just direct message content
- Must sound like a real person, not a form letter

Original postcard to shorten:
${originalPostcard}

Write the shortened version that focuses on the most compelling point:`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      temperature: 0.1,
      system: SHORTENING_PROMPT,
      messages: [{ role: 'user', content: `User context: ${concerns} | Personal impact: ${personalImpact} | Location: ${location.city}, ${location.state}` }]
    })
  });

  const result = await response.json();
  const shortenedText = result.content[0]?.text?.trim() || '';
  
  return shortenedText;
}

async function generatePostcardAndSources({ zipCode, concerns, personalImpact, representative }: {
  zipCode: string,
  concerns: string,
  personalImpact: string,
  representative: any
}): Promise<{ postcard: string, sources: Source[] }> {
  try {
    console.log(`Generating postcard for "${concerns}" in ${zipCode}`);
    
    // Step 1: Analyze theme
    const themeAnalysis = await analyzeTheme({ concerns, personalImpact, zipCode });
    console.log(`Theme identified: ${themeAnalysis.primaryTheme}`);
    
    // Step 2: Discover sources (Perplexity API search)
    const sources = await discoverSources(themeAnalysis, zipCode);
    console.log(`Found ${sources.length} sources`);
    
    // Step 3: Draft postcard
    let postcard = await draftPostcard({ concerns, personalImpact, zipCode, themeAnalysis, sources, representative });
    console.log(`Generated postcard: ${postcard.length} characters`);
    
    // Step 4: Shorten if needed
    if (postcard.length > 300) {
      console.log(`Postcard too long (${postcard.length} chars), shortening...`);
      const shortenedPostcard = await shortenPostcard(postcard, concerns, personalImpact, zipCode);
      console.log(`Shortened postcard: ${shortenedPostcard.length} characters`);
      
      // Use shortened version if it's actually shorter and under limit
      if (shortenedPostcard.length < postcard.length && shortenedPostcard.length <= 300) {
        postcard = shortenedPostcard;
      } else {
        // If shortening failed, try basic truncation as last resort
        console.log('Shortening API failed, using truncation fallback');
        postcard = postcard.substring(0, 250);
      }
    }
    
    return { postcard, sources };
    
  } catch (error) {
    console.error("Error generating postcard:", error);
    
    // Fallback simple postcard
    const { state } = await getLocationFromZip(zipCode);
    let fallbackPostcard = `${personalImpact} Please address ${concerns} affecting ${state} families.`;

    // Apply shortening to fallback postcard if needed
    if (fallbackPostcard.length > 300) {
      console.log(`Fallback postcard too long (${fallbackPostcard.length} chars), shortening...`);
      try {
        const shortenedFallback = await shortenPostcard(fallbackPostcard, concerns, personalImpact, zipCode);
        if (shortenedFallback.length < fallbackPostcard.length && shortenedFallback.length <= 300) {
          fallbackPostcard = shortenedFallback;
          console.log(`Used shortened fallback: ${fallbackPostcard.length} characters`);
        } else {
          // Basic truncation as last resort
          fallbackPostcard = fallbackPostcard.substring(0, 250);
          console.log(`Used truncated fallback: ${fallbackPostcard.length} characters`);
        }
      } catch (shorteningError) {
        console.error("Fallback shortening failed:", shorteningError);
        // Basic truncation as last resort
        fallbackPostcard = fallbackPostcard.substring(0, 250);
        console.log(`Used truncated fallback after shortening error: ${fallbackPostcard.length} characters`);
      }
    }

    return { 
      postcard: fallbackPostcard, 
      sources: [{ 
        url: "https://congress.gov", 
        outlet: "Congress.gov", 
        summary: "Congressional information", 
        headline: "Congressional Information" 
      }] 
    };
  }
}

serve(async (req) => {
  console.log('Edge function called - draft-postcard-message (Hybrid System)');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const requestBody = await req.json();
    const { concerns, personalImpact, representative, zipCode, inviteCode } = requestBody;
    
    if (!concerns || !representative || !zipCode) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: concerns, representative, or zipCode'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Create Supabase client with service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // First, always insert the postcard draft with pending status and user inputs
    const { data: postcardDraft, error: draftError } = await supabaseClient
      .from('postcard_drafts')
      .insert({
        invite_code: inviteCode,
        zip_code: zipCode,
        concerns: concerns,
        personal_impact: personalImpact,
        generation_status: 'pending',
        recipient_type: representative.type === 'representative' ? 'representative' : 'senator',
        recipient_snapshot: representative
      })
      .select()
      .single();

    if (draftError) {
      console.error("Error inserting postcard draft:", draftError);
      return new Response(JSON.stringify({
        error: 'Failed to save draft record'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let finalResult = { postcard: '', sources: [] as Array<{description: string, url: string, dataPointCount: number}> };
    let apiStatusCode = 200;
    let apiStatusMessage = 'Success';
    let generationStatus = 'success';

    try {
      console.log(`🧠 Generating postcard for: "${concerns}"`);
      
      // Use the hybrid postcard generation system
      const result = await generatePostcardAndSources({
        zipCode: zipCode,
        concerns: concerns,
        personalImpact: personalImpact || `This issue matters deeply to me as a constituent in ZIP ${zipCode}`,
        representative: representative
      });
      
      // Transform sources to match app's expected format
      const appSources = result.sources.map((source) => ({
        description: source.headline || source.summary,
        url: source.url,
        outlet: source.outlet,
        headline: source.headline,
        summary: source.summary
      }));
      
      finalResult = {
        postcard: result.postcard,
        sources: appSources
      };
      
      console.log(`✅ Generated postcard (${result.postcard.length} chars) with ${result.sources.length} sources`);
      
    } catch (error) {
      console.error('AI generation error:', error);
      generationStatus = 'error';
      apiStatusCode = 500;
      apiStatusMessage = error.message || 'AI generation failed';
      // finalResult remains empty but we continue to save the record
    }

    // Update the postcard draft with results (success or failure)
    const { error: updateError } = await supabaseClient
      .from('postcard_drafts')
      .update({
        ai_drafted_message: finalResult.postcard || null,
        generation_status: generationStatus,
        api_status_code: apiStatusCode,
        api_status_message: apiStatusMessage
      })
      .eq('id', postcardDraft.id);

    if (updateError) {
      console.error("Error updating postcard draft:", updateError);
      // Continue anyway since we already have the draft saved
    }

    // Insert sources if available and generation was successful
    if (finalResult.sources && finalResult.sources.length > 0) {
      const sourcesData = finalResult.sources.map((source, index) => ({
        postcard_draft_id: postcardDraft.id,
        ordinal: index + 1,
        description: source.description,
        url: source.url,
        data_point_count: source.dataPointCount || 0
      }));

      const { error: sourcesError } = await supabaseClient
        .from('postcard_draft_sources')
        .insert(sourcesData);

      if (sourcesError) {
        console.error("Error inserting sources:", sourcesError);
        // Don't fail the request for sources error, just log it
      } else {
        // Update the sources_count in postcard_drafts
        const { error: countError } = await supabaseClient
          .from('postcard_drafts')
          .update({ sources_count: finalResult.sources.length })
          .eq('id', postcardDraft.id);
        
        if (countError) {
          console.error("Error updating sources count:", countError);
        }
      }
    }
    
    // Return in app's expected format with draft ID (even if AI generation failed)
return new Response(JSON.stringify({ 
      draftMessage: finalResult.postcard,
      postcard: finalResult.postcard,
      sources: finalResult.sources,
      draftId: postcardDraft.id
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Error in function:', error);
    return new Response(JSON.stringify({
      error: `Generation failed: ${error.message}`
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
