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
  // Hardcoded for local testing
  if (envVar === 'anthropickey') return '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';
  if (envVar === 'perplexitykey') return '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';
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
  try {
    const apiKey = getApiKey('perplexitykey');
    const location = await getLocationFromZip(zipCode);
    
    console.log(`🔍 Discovering sources for: ${themeAnalysis.primaryTheme}`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
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

    if (!response.ok) {
      console.error(`Perplexity API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const result = await response.json();
    console.log(`📡 Perplexity API response status: ${response.status}`);
    
    const searchContent = result.choices[0]?.message?.content || '';
    const citations = result.citations || [];
    
    console.log(`📰 Found ${citations.length} citations from Perplexity`);
    
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
    
    console.log(`✅ Processed ${sources.length} sources successfully`);
    return sources.slice(0, 4); // Return top 4 sources
    
  } catch (error) {
    console.error('🚨 Error discovering sources:', error);
    return [];
  }
}

async function draftPostcard({ concerns, personalImpact, zipCode, themeAnalysis, sources }: {
  concerns: string,
  personalImpact: string,
  zipCode: string,
  themeAnalysis: ThemeAnalysis,
  sources: Source[]
}): Promise<string> {
  const apiKey = getApiKey('anthropickey');
  const location = await getLocationFromZip(zipCode);
  
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

async function shortenPostcard(originalPostcard: string, concerns: string, personalImpact: string, zipCode: string): Promise<string> {
  const apiKey = getApiKey('anthropickey');
  const location = await getLocationFromZip(zipCode);
  
  const SHORTENING_PROMPT = `You are an expert at shortening congressional postcards while maintaining their impact and authenticity.

TASK: Shorten this postcard to under 290 characters while keeping it excellent.

STRATEGY:
- If the postcard makes multiple points, choose the STRONGEST one and focus on it
- Remove secondary arguments - don't try to cram everything in
- Keep the personal connection and emotional impact
- Maintain the authentic voice and conversational tone
- Include a call to action 
- Preserve the exact format: Rep. [LastName], [content] Sincerely, [name]

CRITICAL NAME PLACEHOLDER RULE:
- ALWAYS end with exactly "Sincerely, [name]" - never substitute this placeholder
- DO NOT write "A constituent" or location-specific signatures
- The [name] placeholder will be replaced later - keep it exactly as [name]

QUALITY STANDARDS:
- The shortened version should be a complete, compelling postcard on its own
- Better to make one point well than multiple points poorly
- Keep contractions and natural language
- Don't sacrifice authenticity for brevity

ABSOLUTE REQUIREMENTS:
- Must be under 290 characters (including newlines)
- Must maintain Rep./Sincerely format with [name] placeholder
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

async function generatePostcardAndSources({ zipCode, concerns, personalImpact }: {
  zipCode: string,
  concerns: string,
  personalImpact: string
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
    let postcard = await draftPostcard({ concerns, personalImpact, zipCode, themeAnalysis, sources });
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
        const lines = postcard.split('\n');
        if (lines.length >= 3) {
          // Keep Rep. line, first content line, and Sincerely line
          postcard = [lines[0], lines[1].substring(0, 200), lines[lines.length - 1]].join('\n');
        }
      }
    }
    
    return { postcard, sources };
    
  } catch (error) {
    console.error("Error generating postcard:", error);
    
    // Fallback simple postcard
    const { state } = await getLocationFromZip(zipCode);
    let fallbackPostcard = `Rep. Smith,

${personalImpact} Please address ${concerns} affecting ${state} families.

Sincerely, [name]`;

    // Apply shortening to fallback postcard if needed
    if (fallbackPostcard.length > 290) {
      console.log(`Fallback postcard too long (${fallbackPostcard.length} chars), shortening...`);
      try {
        const shortenedFallback = await shortenPostcard(fallbackPostcard, concerns, personalImpact, zipCode);
        if (shortenedFallback.length < fallbackPostcard.length && shortenedFallback.length <= 290) {
          fallbackPostcard = shortenedFallback;
          console.log(`Used shortened fallback: ${fallbackPostcard.length} characters`);
        } else {
          // Basic truncation as last resort
          const lines = fallbackPostcard.split('\n');
          if (lines.length >= 3) {
            fallbackPostcard = [lines[0], lines[1].substring(0, 150), lines[lines.length - 1]].join('\n');
            console.log(`Used truncated fallback: ${fallbackPostcard.length} characters`);
          }
        }
      } catch (shorteningError) {
        console.error("Fallback shortening failed:", shorteningError);
        // Basic truncation as last resort
        const lines = fallbackPostcard.split('\n');
        if (lines.length >= 3) {
          fallbackPostcard = [lines[0], lines[1].substring(0, 150), lines[lines.length - 1]].join('\n');
          console.log(`Used truncated fallback after shortening error: ${fallbackPostcard.length} characters`);
        }
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
  console.log("Edge function called - draft-postcard-message (Enhanced System)");
  
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
    const { postcard, sources } = await generatePostcardAndSources({
      zipCode,
      concerns,
      personalImpact
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
        postcard, 
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
