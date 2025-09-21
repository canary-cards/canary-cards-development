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

async function generatePostcard({ concerns, personalImpact, zipCode, representative }: {
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

    // Generate postcard
    const { postcard, sources } = await generatePostcard({
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