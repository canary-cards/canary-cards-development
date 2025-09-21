import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface Source {
  url: string;
  outlet: string;
  title: string;
  summary: string;
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
          content: 'You are a research assistant finding current news. For each source you cite, format it exactly as: [TITLE] | [OUTLET] | [SUMMARY]. Be precise with outlet names (e.g., "CNN", "The New York Times", "Washington Post", not domain names).'
        },
        {
          role: 'user',
          content: `Find 3-4 recent news articles about "${themeAnalysis.primaryTheme}" affecting ${location.city}, ${location.state} or ${location.state} generally.

Format each source as:
[Article Title] | [Outlet Name] | [Brief summary of key points]

Focus on 2024-2025 developments and credible news sources.`
        }
      ],
      max_tokens: 800,
      temperature: 0.1,
      return_citations: true
    })
  });

  const result = await response.json();
  const searchContent = result.choices[0]?.message?.content || '';
  const citations = result.citations || [];
  
  console.log('Perplexity search content:', searchContent);
  console.log('Citations:', citations);
  
  const sources: Source[] = [];
  
  // Try to parse structured sources from content first
  const sourceLines = searchContent.split('\n').filter(line => 
    line.includes(' | ') && line.trim().length > 10
  );
  
  console.log('Source lines found:', sourceLines);
  
  for (let i = 0; i < Math.min(sourceLines.length, citations.length, 4); i++) {
    const line = sourceLines[i];
    const url = citations[i] as string;
    
    const parts = line.split(' | ');
    console.log(`Processing source ${i+1}: parts = ${parts.length}`, parts);
    
    if (parts.length >= 3) {
      const title = parts[0].trim().replace(/^\d+\.\s*/, '').replace(/^\[|\]$/g, '');
      sources.push({
        url,
        outlet: parts[1].trim().replace(/^\[|\]$/g, ''),
        title: title || `Article ${i+1}`,
        summary: parts[2].trim().replace(/^\[|\]$/g, '').substring(0, 200),
      });
      console.log(`Added structured source: ${title}`);
    } else {
      // Fallback: extract better outlet names
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace('www.', '');
      
      let outlet = 'News Source';
      if (domain.includes('cnn.com')) outlet = 'CNN';
      else if (domain.includes('nytimes.com')) outlet = 'The New York Times';
      else if (domain.includes('washingtonpost.com')) outlet = 'Washington Post';
      else if (domain.includes('reuters.com')) outlet = 'Reuters';
      else if (domain.includes('ap.org') || domain.includes('apnews.com')) outlet = 'Associated Press';
      else if (domain.includes('npr.org')) outlet = 'NPR';
      else if (domain.includes('politico.com')) outlet = 'Politico';
      else if (domain.includes('axios.com')) outlet = 'Axios';
      else if (domain.includes('bloomberg.com')) outlet = 'Bloomberg';
      else if (domain.includes('hhs.gov')) outlet = 'Dept. of Health & Human Services';
      else if (domain.includes('cdc.gov')) outlet = 'CDC';
      else if (domain.includes('fda.gov')) outlet = 'FDA';
      else if (domain.includes('.gov')) outlet = 'Government Source';
      else {
        // Clean up domain name as last resort
        outlet = domain.split('.')[0]
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
      }
      
      // Derive a readable title from the URL slug
      const slug = urlObj.pathname.split('/').filter(Boolean).pop() || '';
      let title = slug
        .replace(/[-_]/g, ' ')
        .replace(/\.(html|htm|php)$/i, '')
        .trim();
      if (title) {
        title = title.replace(/\b\w/g, l => l.toUpperCase());
      }
      if (!title || title.length < 4) {
        title = `${outlet} Article`;
      }

      // Extract a reasonable summary from the content
      const sentences = searchContent.split(/[.!?]+/);
      let summary = sentences.find(s => 
        s.length > 30 && s.length < 200 && 
        s.toLowerCase().includes(themeAnalysis.primaryTheme.toLowerCase())
      )?.trim() || 'Recent developments in this policy area.';
      
      sources.push({
        url,
        outlet,
        title,
        summary: summary.substring(0, 200)
      });
      console.log(`Added fallback source: ${title}`);
    }
  }
  
  console.log(`Total sources processed: ${sources.length}`);
    }
  }
  
  return sources.slice(0, 4);
}

async function draftPostcard({ concerns, personalImpact, zipCode, themeAnalysis, sources, representative }: {
  concerns: string,
  personalImpact: string,
  zipCode: string,
  themeAnalysis: ThemeAnalysis,
  sources: Source[],
  representative: { name: string; type?: string }
}): Promise<string> {
  const apiKey = getApiKey('ANTHROPIC_API_KEY_3', getApiKey('anthropickey'));
  const location = await getLocationFromZip(zipCode);
  const repLastName = (representative?.name || '').trim().split(' ').slice(-1)[0] || 'Representative';
  const senderSignature = `A constituent in ${location.city}, ${location.state}`;
  
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

STRICT NAME RULES:
- Use the provided RepresentativeLastName EXACTLY. Do not guess another name.
- Use the provided SenderSignature EXACTLY. Do not invent a different name.

SOURCE INTEGRATION:
- Reference relevant bills as "H.R. [NUMBER]" when appropriate
- Use recent developments to add urgency
- Connect national news to local impact
- Only use sources that genuinely relate to the concern

Write the complete postcard following these guidelines exactly.`;

  const today = new Date().toISOString().split('T')[0];
  const context = `
Today's date: ${today}
User concern: ${concerns}
Personal impact: ${personalImpact || ''}
Location: ${location.city}, ${location.state}
RepresentativeLastName: ${repLastName}
SenderSignature: ${senderSignature}
Theme analysis: ${JSON.stringify(themeAnalysis, null, 2)}
Selected sources:
${sources.map((s, i) => `  ${i+1}. Title: ${s.title || (s.url.split('/').pop()?.replace(/-/g, ' ') || 'Article')}
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
  let text = result.content?.[0]?.text?.trim() || '';

  // Minimal guard: ensure we used the correct last name and have non-empty body
  if (!text.includes(`Rep. ${repLastName}`) || !text.includes('Sincerely,')) {
    console.warn('Postcard missing required salutation/signature; regenerating minimal fallback body');
    text = `Rep. ${repLastName},\n\nI'm writing from ${location.city}. ${concerns} hits home here — please act so families can afford care.\n\nSincerely, ${senderSignature}`;
  }
  
  return text;
}

async function shortenPostcard(originalPostcard: string, concerns: string, personalImpact: string, zipCode: string): Promise<string> {
  const apiKey = getApiKey('ANTHROPIC_API_KEY_3', getApiKey('anthropickey'));
  const location = await getLocationFromZip(zipCode);
  
  const SHORTENING_PROMPT = `You are an expert at shortening congressional postcards while maintaining their impact and authenticity.

TASK: Shorten this postcard to under 290 characters while keeping it excellent.

STRATEGY:
- If the postcard makes multiple points, choose the STRONGEST one and focus on it
- Remove secondary arguments - don't try to cram everything in
- Keep the personal connection and emotional impact
- Maintain the authentic voice and conversational tone
- Preserve the exact format: Rep. [LastName], [content] Sincerely, [Name]

QUALITY STANDARDS:
- The shortened version should be a complete, compelling postcard on its own
- Better to make one point well than multiple points poorly
- Keep contractions and natural language
- Don't sacrifice authenticity for brevity

ABSOLUTE REQUIREMENTS:
- Must be under 290 characters (including newlines)
- Must maintain Rep./Sincerely format
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
  representative: { name: string; type?: string }
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

Sincerely, Concerned Citizen`;

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
        summary: "Congressional information" 
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
      const appSources = result.sources.map((source, index) => {
        console.log(`Mapping source ${index + 1}: title="${source.title}", summary="${source.summary.substring(0, 50)}..."`);
        return {
          description: source.title || source.summary || `Source ${index + 1}`,
          url: source.url,
          dataPointCount: index + 1
        };
      });
      
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