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
  if (typeof globalThis.Deno !== 'undefined' && globalThis.Deno.env) {
    try {
      const val = globalThis.Deno.env.get(envVar);
      if (val) return val;
    } catch {}
  }
  if (fallback) return fallback;
  throw new Error(`Missing required API key: ${envVar}`);
}

// Cache for location lookups to avoid repeated API calls
const locationCache = new Map<string, { state: string; city: string; region: string }>();

interface GeocodioResponse {
  results: Array<{
    address_components: {
      city: string;
      state: string;
      zip: string;
      county?: string;
    };
  }>;
}

async function getLocationFromZip(zipCode: string): Promise<{ state: string; city: string; region: string }> {
  // Check cache first
  if (locationCache.has(zipCode)) {
    return locationCache.get(zipCode)!;
  }

  const geocodioApiKey = getApiKey('GEOCODIO_KEY');
  
  try {
    console.log(`Looking up location for ZIP code: ${zipCode}`);
    
    const response = await fetch(
      `https://api.geocod.io/v1.9/geocode?q=${zipCode}&api_key=${geocodioApiKey}`
    );
    
    if (!response.ok) {
      console.error(`Geocodio API error: ${response.status} ${response.statusText}`);
      throw new Error('Geocodio API failed');
    }
    
    const data: GeocodioResponse = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.error(`No results found for zip code: ${zipCode}`);
      throw new Error('No location data found');
    }
    
    const result = data.results[0];
    const location = {
      state: result.address_components.state,
      city: result.address_components.city,
      region: result.address_components.county || `${result.address_components.city} area`
    };
    
    // Cache the result
    locationCache.set(zipCode, location);
    console.log(`Location found: ${location.city}, ${location.state}`);
    
    return location;
    
  } catch (error) {
    console.error('Error looking up zip code:', error);
    
    // Fallback to a generic location if API fails
    const fallbackLocation = {
      state: 'Unknown',
      city: 'Unknown', 
      region: 'Unknown'
    };
    
    // Cache the fallback to avoid repeated failures
    locationCache.set(zipCode, fallbackLocation);
    return fallbackLocation;
  }
}

async function analyzeTheme({ concerns, personalImpact, zipCode }: {
  concerns: string,
  personalImpact: string,
  zipCode: string
}): Promise<ThemeAnalysis> {
  const apiKey = getApiKey('ANTHROPIC_API_KEY_3', getApiKey('anthropickey'));
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
  try {
    const apiKey = getApiKey('perplexitykey');
    const location = await getLocationFromZip(zipCode);
    
    console.log('🔍 Calling Perplexity API for source discovery...');
    
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
            content: 'You are a research assistant that finds current news and provides structured information. For each article you cite, provide the exact title, publication date, outlet name, and a useful summary. Focus on recent developments and local impacts.'
          },
          {
            role: 'user',
            content: `Find recent news articles and policy developments about "${themeAnalysis.primaryTheme}" specifically affecting ${location.city}, ${location.state} or the broader ${location.state} area.

For each article you reference, please provide:
- TITLE: [exact article headline]
- OUTLET: [full publication name] 
- DATE: [publication date if available]
- SUMMARY: [2-3 sentence summary of key points relevant to ${themeAnalysis.primaryTheme}]

Focus on 2024-2025 developments. Prioritize local ${location.state} sources when possible.`
          }
        ],
        max_tokens: 800,
        temperature: 0.1,
        return_citations: true
      })
    });

    console.log(`🔍 Perplexity API response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🚨 Perplexity API error:', response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('🔍 Perplexity API result:', JSON.stringify(result, null, 2));
    
    const searchContent = result.choices[0]?.message?.content || '';
    const citations = result.citations || [];
    
    console.log(`🔍 Found ${citations.length} citations from Perplexity`);
    
    const sources: Source[] = [];
    
    for (const [index, citationUrl] of citations.entries()) {
      const url = citationUrl as string;
      // Try to extract headline from Perplexity content using TITLE: marker
      let headline = '';
      const titleRegex = new RegExp(`TITLE:([^\n\r]+)[\n\r]+OUTLET:.*?${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      const titleMatch = searchContent.match(titleRegex);
      if (titleMatch && titleMatch[1]) {
        headline = titleMatch[1].trim();
      } else {
        // Fallback: look for TITLE: line near the URL
        const urlIndex = searchContent.indexOf(url);
        if (urlIndex !== -1) {
          const before = searchContent.substring(Math.max(0, urlIndex - 400), urlIndex);
          const titleLine = before.split(/\n/).reverse().find(line => line.trim().startsWith('TITLE:'));
          if (titleLine) headline = titleLine.replace('TITLE:', '').trim();
        }
      }
      // Fallback to last part of URL if no headline found
      if (!headline) {
        const urlParts = url.split('/');
        const lastPart = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
        headline = lastPart ? lastPart.replace(/[-_]/g, ' ').replace(/\.(html|htm|php)$/i, '').replace(/\b\w/g, l => l.toUpperCase()) : url;
      }
      // Extract outlet from URL
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      const outlet = domain.split('.')[0].replace(/\b\w/g, l => l.toUpperCase());
      // Extract actual article summary from Perplexity content
      let summary = '';
      const urlIndex = searchContent.indexOf(url);
      if (urlIndex !== -1) {
        const beforeUrl = searchContent.substring(Math.max(0, urlIndex - 400), urlIndex);
        const afterUrl = searchContent.substring(urlIndex, Math.min(searchContent.length, urlIndex + 400));
        const contextSentences = (beforeUrl + afterUrl).split(/[.!?]+/);
        let meaningfulSentences = contextSentences.filter(s =>
          s.length > 30 && s.length < 300 &&
          !s.includes('Here are recent') &&
          !s.includes('TITLE:') &&
          !s.includes('OUTLET:') &&
          !s.includes('Find recent') &&
          !s.toLowerCase().includes('specifically affecting')
        );
        let best = meaningfulSentences.find(s =>
          s.toLowerCase().includes(themeAnalysis.primaryTheme.toLowerCase()) ||
          themeAnalysis.urgencyKeywords.some(k => s.toLowerCase().includes(k.toLowerCase()))
        );
        if (!best && meaningfulSentences.length > 0) best = meaningfulSentences[0];
        if (best) summary = best.trim();
      }
      if (!summary) {
        const allSentences = searchContent.split(/[.!?]+/);
        const goodSentences = allSentences.filter(s =>
          s.length > 40 && s.length < 300 &&
          !s.includes('Here are recent') &&
          !s.includes('TITLE:') &&
          !s.includes('OUTLET:') &&
          !s.includes('Find recent') &&
          !s.includes('Focus on 2024-2025')
        );
        if (goodSentences.length > 0) summary = goodSentences[0].trim();
      }
      if (!summary) summary = 'Recent developments in this policy area.';
      sources.push({
        url: url,
        outlet: outlet,
        summary: summary.substring(0, 250) + (summary.length > 250 ? '...' : ''),
        headline: headline
      });
    }
    
    return sources.slice(0, 4); // Return top 4 sources
    
  } catch (error) {
    console.error('Error discovering sources:', error);
    return []; // Return empty array on error
  }
}

async function generatePostcardWithSources({ concerns, personalImpact, zipCode, representative }: {
  concerns: string,
  personalImpact: string,
  zipCode: string,
  representative: { name: string; type?: string }
}): Promise<{ postcard: string, sources: Source[] }> {
  try {
    console.log(`🧠 Generating enhanced postcard for: "${concerns}" in ${zipCode}`);
    
    // Step 1: Analyze theme
    const themeAnalysis = await analyzeTheme({ concerns, personalImpact, zipCode });
    console.log(`Theme identified: ${themeAnalysis.primaryTheme}`);
    
    // Step 2: Discover sources (Perplexity API search)
    const sources = await discoverSources(themeAnalysis, zipCode);
    console.log(`Found ${sources.length} sources`);
    
    // Step 3: Draft postcard with enhanced context
    let postcard = await draftEnhancedPostcard({ 
      concerns, 
      personalImpact, 
      zipCode, 
      representative, 
      themeAnalysis, 
      sources 
    });
    console.log(`Generated postcard: ${postcard.length} characters`);
    
    // Step 4: Shorten if needed
    if (postcard.length > 290) {
      console.log(`Postcard too long (${postcard.length} chars), shortening...`);
      const shortenedPostcard = await shortenPostcard(postcard, concerns, personalImpact, zipCode);
      console.log(`Shortened postcard: ${shortenedPostcard.length} characters`);
      
      // Use shortened version if it's actually shorter and under limit
      if (shortenedPostcard.length < postcard.length && shortenedPostcard.length <= 290) {
        postcard = shortenedPostcard;
      } else {
        // If shortening failed, try basic truncation as last resort
        console.log('Shortening API failed, using truncation fallback');
        const location = await getLocationFromZip(zipCode);
        const repLastName = (representative?.name || '').trim().split(' ').slice(-1)[0] || 'Representative';
        const senderSignature = `A constituent in ${location.city}, ${location.state}`;
        postcard = `Rep. ${repLastName},\n\n${concerns} affects families in ${location.city}. Please help us.\n\nSincerely, ${senderSignature}`;
      }
    }
    
    return { postcard, sources };
    
  } catch (error) {
    console.error("Error generating enhanced postcard:", error);
    
    // Fallback to simple postcard generation
    return await generateSimplePostcard({ concerns, personalImpact, zipCode, representative });
  }
}

async function draftEnhancedPostcard({ concerns, personalImpact, zipCode, representative, themeAnalysis, sources }: {
  concerns: string,
  personalImpact: string,
  zipCode: string,
  representative: { name: string; type?: string },
  themeAnalysis: ThemeAnalysis,
  sources: Source[]
}): Promise<string> {
  const apiKey = getApiKey('ANTHROPIC_API_KEY_3', getApiKey('anthropickey'));
  const location = await getLocationFromZip(zipCode);
  const repLastName = (representative?.name || '').trim().split(' ').slice(-1)[0] || 'Representative';
  
  const POSTCARD_SYSTEM_PROMPT = `Write a congressional postcard that sounds like a real person, not a political speech.

EXACT FORMAT REQUIREMENTS (NON-NEGOTIABLE):
Rep. [LastName],
[content - do NOT repeat "Rep." or "Dear Rep." here]
Sincerely, [name]

CRITICAL NAME PLACEHOLDER RULE:
- ALWAYS end with exactly "Sincerely, [name]" - never substitute this placeholder
- DO NOT write "A constituent" or location-specific signatures
- The [name] placeholder will be replaced later - keep it exactly as [name]

🚨 ABSOLUTE LENGTH RULE (DO NOT BREAK):
- HARD MAXIMUM: 290 characters (including newlines). THIS IS A NON-NEGOTIABLE, CRITICAL REQUIREMENT.
- If your draft is even 1 character over, it will be rejected and not sent. DO NOT EXCEED 290 CHARACTERS UNDER ANY CIRCUMSTANCES.
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

Write the complete postcard following these guidelines exactly. If you are unsure, it is better to be short than to go over the limit. Never exceed 290 characters.`;

  const today = new Date().toISOString().split('T')[0];
  const context = `
Today's date: ${today}
User concern: ${concerns}
Personal impact: ${personalImpact || ''}
Location: ${location.city}, ${location.state}
Representative: ${repLastName}
Theme analysis: ${JSON.stringify(themeAnalysis, null, 2)}
Selected sources:
${sources.map((s, i) => `  ${i+1}. Title: ${s.headline}
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

async function generateSimplePostcard({ concerns, personalImpact, zipCode, representative }: {
  concerns: string,
  personalImpact: string,
  zipCode: string,
  representative: { name: string; type?: string }
}): Promise<{ postcard: string, sources: Source[] }> {
  const apiKey = getApiKey('ANTHROPIC_API_KEY_3', getApiKey('anthropickey'));
  const location = await getLocationFromZip(zipCode);
  const repLastName = (representative?.name || '').trim().split(' ').slice(-1)[0] || 'Representative';
  const senderSignature = `A constituent in ${location.city}, ${location.state}`;
  
  console.log(`🧠 Generating postcard for: "${concerns}" in ${zipCode}`);
  console.log(`Location found: ${location.city}, ${location.state}`);
  
  const POSTCARD_SYSTEM_PROMPT = `Write a congressional postcard that sounds like a real person, not a political speech.

EXACT FORMAT REQUIREMENTS (NON-NEGOTIABLE):
Rep. [LastName],
[content - 1–2 sentences. Do NOT repeat "Rep." or "Dear Rep." here. Must not be empty.]
Sincerely, [SenderName]

LENGTH REQUIREMENTS:
- TARGET: 275-280 characters (optimal space utilization)
- HARD MAXIMUM: 290 characters (NEVER EXCEED)
- Character counting includes newlines

TONE & STYLE (CRITICAL FOR AUTHENTICITY):
- Use everyday conversational language with contractions ("can't", "won't", "we're")
- Express genuine emotion but stay factual - think "concerned neighbor"
- Avoid formal political terms
- Focus on local impact in ${location.city}, ${location.state}

STRICT NAME RULES:
- Use the provided RepresentativeLastName EXACTLY. Do not guess another name.
- Use the provided SenderSignature EXACTLY. Do not invent a different name.

Write the complete postcard following these guidelines exactly.`;

  const today = new Date().toISOString().split('T')[0];
  const context = `
Today's date: ${today}
User concern: ${concerns}
Personal impact: ${personalImpact || ''}
Location: ${location.city}, ${location.state}
RepresentativeLastName: ${repLastName}
SenderSignature: ${senderSignature}

Write a postcard addressing "${concerns}" and how it affects people in ${location.city}, ${location.state}.`;

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
  let text = result.content?.[0]?.text?.trim() || '';

  // Ensure we used the correct format
  if (!text.includes(`Rep. ${repLastName}`) || !text.includes('Sincerely,')) {
    console.warn('Postcard missing required format; generating fallback');
    text = `Rep. ${repLastName},\n\nI'm writing from ${location.city} about ${concerns}. This affects our community directly and we need action to help families here.\n\nSincerely, ${senderSignature}`;
  }
  
  console.log(`Generated postcard: ${text.length} characters`);
  
  // Check if postcard is too long and shorten if needed
  if (text.length > 290) {
    console.log(`Postcard too long (${text.length} chars), shortening...`);
    text = await shortenPostcard(text, concerns, personalImpact, zipCode);
    console.log(`Shortened postcard: ${text.length} characters`);
  }
  
  // Return empty sources array for now (simplified version)
  return { postcard: text, sources: [] };
}

async function shortenPostcard(originalPostcard: string, concerns: string, personalImpact: string, zipCode: string): Promise<string> {
  const apiKey = getApiKey('ANTHROPIC_API_KEY_3', getApiKey('anthropickey'));
  const location = await getLocationFromZip(zipCode);
  
  const SHORTENING_PROMPT = `You are an expert at shortening congressional postcards while maintaining their impact and authenticity.

TASK: Shorten this postcard to under 290 characters while keeping it excellent.

STRATEGY:
- If the postcard makes multiple points, choose the STRONGEST one and focus on it
- Use contractions ("can't", "won't", "we're", "I'm") to save space
- Remove redundant words but keep the emotional impact
- Maintain the exact format: "Rep. [Name],\\n[content]\\nSincerely, [signature]"
- Keep the local angle and personal tone

CRITICAL: Count characters carefully. The result MUST be under 290 characters total.`;

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
      messages: [{
        role: 'user',
        content: `ORIGINAL POSTCARD (${originalPostcard.length} characters):\n${originalPostcard}\n\nShorten this to under 290 characters while keeping the core message about "${concerns}" and its impact in ${location.city}, ${location.state}.`
      }]
    })
  });

  const result = await response.json();
  let shortened = result.content?.[0]?.text?.trim() || originalPostcard;
  
  // Emergency fallback if still too long
  if (shortened.length > 290) {
    const repLastName = originalPostcard.match(/Rep\. (\w+),/)?.[1] || 'Representative';
    const senderSignature = `A constituent in ${location.city}, ${location.state}`;
    shortened = `Rep. ${repLastName},\n\n${concerns} affects families in ${location.city}. Please help us.\n\nSincerely, ${senderSignature}`;
  }
  
  return shortened;
}

serve(async (req) => {
  console.log("Edge function called - draft-postcard-message (Hybrid System)");
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body
    const body = await req.json();
    const { concerns, personalImpact, zipCode, representative } = body;
    
    console.log(`Generating postcard for "${concerns}" in ${zipCode}`);

    // Validate required fields
    if (!concerns || !zipCode || !representative) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: concerns, zipCode, and representative are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = getApiKey('SUPABASE_URL');
    const supabaseServiceKey = getApiKey('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate postcard with enhanced features (theme analysis + sources)
    const { postcard, sources } = await generatePostcardWithSources({
      zipCode,
      concerns,
      personalImpact,
      representative
    });
    
    console.log(`✅ Generated postcard (${postcard.length} chars) with ${sources.length} sources`);

    // Save draft to database
    const postcardData = {
      concerns,
      personal_impact: personalImpact,
      zip_code: zipCode,
      representative_name: representative.name,
      representative_type: representative.type || 'representative',
      message: postcard,
      sources: sources || [],
      created_at: new Date().toISOString()
    };

    const { data: draftData, error: draftError } = await supabase
      .from('postcard_drafts')
      .insert(postcardData)
      .select('id')
      .single();

    if (draftError) {
      console.error('Error saving draft:', draftError);
      // Continue anyway - don't fail the generation
    }

    const draftId = draftData?.id || null;

    // Return the generated postcard
    return new Response(
      JSON.stringify({ 
        draftMessage: postcard, 
        sources,
        draftId,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in draft-postcard-message:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate postcard',
        details: error.message,
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});