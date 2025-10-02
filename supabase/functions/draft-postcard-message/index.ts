import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

interface Source {
  url: string;
  outlet: string;
  headline: string;
  relevanceScore?: number;
  localPriority?: string;
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

// Helper function to clean AI responses from character count debugging info
function cleanAIResponse(text: string): string {
  if (!text) return text;
  
  const originalText = text;
  
  // Remove various patterns of character count debugging info
  const cleanedText = text
    // Remove [Character count: X] variations
    .replace(/\[Character count:\s*\d+\]/gi, '')
    .replace(/\(Character count:\s*\d+\)/gi, '')
    .replace(/Character count:\s*\d+/gi, '')
    // Remove [X characters] variations  
    .replace(/\[\d+\s*characters?\]/gi, '')
    .replace(/\(\d+\s*characters?\)/gi, '')
    // Remove [Length: X] variations
    .replace(/\[Length:\s*\d+\]/gi, '')
    .replace(/\(Length:\s*\d+\)/gi, '')
    // Remove standalone character counts at end
    .replace(/\s*\d+\s*chars?\s*$/gi, '')
    // Remove extra whitespace and newlines that might be left
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
  
  // Log if we cleaned anything
  if (cleanedText !== originalText) {
    console.log(`🧹 Cleaned AI response: removed character count debugging info`);
    console.log(`Original length: ${originalText.length}, Cleaned length: ${cleanedText.length}`);
  }
  
  return cleanedText;
}

// Helper function to extract representative's last name
function extractRepresentativeLastName(representativeName: string): string {
  if (!representativeName) return 'Representative';
  
  const nameParts = representativeName.trim().split(/\s+/);
  
  // Handle edge cases
  if (nameParts.length === 1) return nameParts[0];
  
  // Get the last part of the name (handles most cases including Jr./Sr.)
  let lastName = nameParts[nameParts.length - 1];
  
  // If last part is a suffix (Jr., Sr., III, etc.), use the second-to-last part
  if (/^(Jr\.?|Sr\.?|III?|IV|V)$/i.test(lastName) && nameParts.length > 2) {
    lastName = nameParts[nameParts.length - 2];
  }
  
  return lastName;
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

async function analyzeTheme({ concerns, personalImpact, location }: {
  concerns: string,
  personalImpact: string,
  location: { state: string; city: string; region: string }
}): Promise<ThemeAnalysis> {
  // Use dedicated theme analysis key with fallback to main key
  const apiKey = getApiKey('ANTHROPIC_THEME_KEY') || getApiKey('ANTHROPIC_KEY');
  
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

async function discoverSources(themeAnalysis: ThemeAnalysis, location: { state: string; city: string; region: string }): Promise<Source[]> {
  const apiKey = getApiKey('PERPLEXITY_KEY');
  
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
          content: `You are a news research assistant specializing in local and national political news. For each source, provide structured information in this EXACT format:

**ARTICLE TITLE:** [The exact headline from the original article]
**OUTLET:** [Publication name like "The Sacramento Bee" or "CNN"]
**RELEVANCE_SCORE:** [Rate 1-10 how relevant this source is to the user's concern]
**LOCAL_PRIORITY:** [Classify as: local or national]

CONTENT TYPE REQUIREMENTS:
- ONLY return: news articles, government reports, policy analysis pieces, and official government announcements
- STRICTLY EXCLUDE: All video content (YouTube, Vimeo, news videos, documentaries), PDFs, social media posts, academic papers, podcasts, and multimedia content
- PRIORITIZE: Local newspapers > State publications > Government sources > National news with local angles

RELEVANCE SCORING GUIDE:
- 9-10: Directly addresses the specific concern with local data
- 7-8: Covers the topic with strong relevance to the region
- 5-6: Related but not directly on topic
- 1-4: Tangentially related or background info

Be extremely precise with article titles - use the actual headline, not a description or URL fragment.`
        },
        {
          role: 'user',
          content: `Find 6-8 recent news articles about "${themeAnalysis.primaryTheme}" affecting ${location.city}, ${location.state} or ${location.state} state.

SOURCE DIVERSITY REQUIREMENT:
- MAXIMUM 1 article per publication/outlet
- Select from DIFFERENT publications to ensure varied perspectives
- Avoid multiple articles from the same news organization

PRIORITIZATION ORDER (search in this order):
1. LOCAL: ${location.city} newspapers, local TV news websites, city government sites, ${location.state} state publications
2. NATIONAL: Only if they have a specific ${location.state} or ${location.city} angle

REQUIRED CONTENT TYPES:
- News articles from established publications
- Government reports and official announcements
- Policy analysis pieces
- Legislative updates

For each source you cite, provide in this EXACT format:
**ARTICLE TITLE:** [Write the EXACT headline from the article - not a summary or description]  
**OUTLET:** [Full publication name]
**RELEVANCE_SCORE:** [Rate 1-10 based on how well this source supports arguments about ${themeAnalysis.primaryTheme}]
**LOCAL_PRIORITY:** [Classify as: local or national]

Focus on news from the last 30 days. Provide relevance scores to help identify the most useful sources.`
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

  // Helper: Extract relevance score and local priority from Perplexity response
  const extractSourceMetadata = (url: string, searchText: string): { relevanceScore: number; localPriority: string } => {
    const urlIndex = searchText.indexOf(url);
    if (urlIndex === -1) return { relevanceScore: 5, localPriority: 'national' };
    
    const beforeUrl = searchText.substring(Math.max(0, urlIndex - 500), urlIndex);
    const afterUrl = searchText.substring(urlIndex, Math.min(searchText.length, urlIndex + 300));
    const context = beforeUrl + afterUrl;
    
    // Extract relevance score
    const scoreMatch = context.match(/\*\*RELEVANCE_SCORE:\*\*\s*(\d+)/i);
    const relevanceScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 5;
    
    // Extract local priority
    const priorityMatch = context.match(/\*\*LOCAL_PRIORITY:\*\*\s*(local|national)/i);
    const localPriority = priorityMatch ? priorityMatch[1].toLowerCase() : 'national';
    
    return { relevanceScore, localPriority };
  };

  // Helper: Parse title from Perplexity response
  const extractPerplexityTitle = (url: string, searchText: string): string => {
    const urlIndex = searchText.indexOf(url);
    if (urlIndex === -1) return '';
    
    const marker = '**ARTICLE TITLE:**';
    const lastTitleIdx = searchText.lastIndexOf(marker, urlIndex);
    if (lastTitleIdx !== -1 && (urlIndex - lastTitleIdx) < 300) {
      const afterTitle = searchText.substring(lastTitleIdx + marker.length, urlIndex);
      const firstLine = afterTitle.split(/\r?\n/)[0].trim();
      if (firstLine) return firstLine.replace(/^[*-]\s*/, '').trim();
    }
    
    return '';
  };

  // Helper: Enhanced domain-based fallback titles
  const getDomainBasedTitle = (url: string, themeAnalysis: ThemeAnalysis): string => {
    const domain = new URL(url).hostname.replace('www.', '');
    const pathParts = new URL(url).pathname.split('/').filter(p => p);
    
    // Government domains - enhanced with path analysis
    if (domain.includes('congress.gov')) {
      if (pathParts.includes('bill')) return 'Congressional Bill Information';
      if (pathParts.includes('committee')) return 'Committee Report';
      return 'Congressional Information';
    }
    if (domain.includes('census.gov')) return 'Census Data and Statistics';
    if (domain.includes('bls.gov')) return 'Bureau of Labor Statistics Report';
    if (domain.includes('ed.gov')) return 'Department of Education Report';
    if (domain.includes('hhs.gov')) return 'Health and Human Services Report';
    if (domain.includes('.gov')) return 'Government Report';
    
    // News domains - enhanced with better names
    const newsDomains: { [key: string]: string } = {
      'nytimes.com': 'New York Times Article',
      'washingtonpost.com': 'Washington Post Article',
      'cnn.com': 'CNN News Report',
      'foxnews.com': 'Fox News Article',
      'bbc.com': 'BBC News Article',
      'reuters.com': 'Reuters Report',
      'apnews.com': 'Associated Press Report',
      'npr.org': 'NPR Report'
    };
    
    if (newsDomains[domain]) return newsDomains[domain];
    
    // Generic news patterns
    if (/(news|times|post|tribune|herald|gazette)/i.test(domain)) {
      return 'News Article';
    }
    
    // Theme-based fallback
    return `${themeAnalysis.primaryTheme.replace(/\b\w/g, l => l.toUpperCase())} Information`;
  };

  // Step 1: Filter and parse all valid URLs with metadata
  interface SourceCandidate {
    url: string;
    perplexityTitle: string;
    relevanceScore: number;
    localPriority: string;
    outlet: string;
  }

  const sourceCandidates: SourceCandidate[] = [];
  
  for (const citationUrl of citations as string[]) {
    const url = citationUrl as string;
    
    // Filter out aggregation/listing pages (be more specific to avoid false positives)
    const urlLower = url.toLowerCase();
    const urlPath = new URL(url).pathname.toLowerCase();
    
    // Only filter if URL ends with these patterns (not just contains)
    if (
      urlPath.endsWith('/tag/') || 
      urlPath.endsWith('/tags/') ||
      urlPath.endsWith('/category/') ||
      urlPath.endsWith('/categories/') ||
      urlPath.endsWith('/archive/') ||
      urlPath.endsWith('/search/') ||
      urlPath.endsWith('/topics/') ||
      urlPath.endsWith('/feeds/') ||
      urlPath.endsWith('/rss/') ||
      urlPath.endsWith('/news/') ||
      /\/\d+\/?$/.test(urlPath) || // URLs ending only with numbers
      urlLower.includes('latest-updates') ||
      urlLower.includes('breaking-news-live')
    ) {
      console.log('Filtered out aggregation page:', url);
      continue;
    }
    
    const metadata = extractSourceMetadata(url, searchContent);
    const perplexityTitle = extractPerplexityTitle(url, searchContent);
    
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    const outlet = domain.split('.')[0].replace(/\b\w/g, l => l.toUpperCase());
    
    sourceCandidates.push({
      url,
      perplexityTitle,
      relevanceScore: metadata.relevanceScore,
      localPriority: metadata.localPriority,
      outlet
    });
  }

  // Step 2: Rank sources by relevance and local priority
  const priorityWeight: { [key: string]: number } = {
    'local': 2,
    'national': 1
  };

  sourceCandidates.sort((a, b) => {
    // Primary: relevance score (higher is better)
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    // Secondary: local priority (local > state > regional > national)
    const aPriority = priorityWeight[a.localPriority] || 0;
    const bPriority = priorityWeight[b.localPriority] || 0;
    return bPriority - aPriority;
  });

  console.log(`Ranked ${sourceCandidates.length} sources by relevance and local priority`);

  // Step 3: Select top 4 sources - return with Perplexity titles or domain fallbacks
  const top4Candidates = sourceCandidates.slice(0, 4);
  const sources: Source[] = [];

  for (const candidate of top4Candidates) {
    // Use Perplexity title if available and non-empty, otherwise use domain-based fallback
    let headline = candidate.perplexityTitle?.trim() || '';
    
    // Use domain-based fallback if no title from Perplexity
    if (!headline || headline.length < 5) {
      headline = getDomainBasedTitle(candidate.url, themeAnalysis);
      console.log(`Using domain fallback title for ${candidate.url}: "${headline}"`);
    }

    sources.push({
      url: candidate.url,
      outlet: candidate.outlet,
      headline,
      relevanceScore: candidate.relevanceScore,
      localPriority: candidate.localPriority
    });
  }
  
  console.log(`Selected top 4 sources with relevance scores: ${sources.map(s => s.relevanceScore).join(', ')}`);
  return sources;
}

async function draftPostcard({ concerns, personalImpact, location, themeAnalysis, sources, representative }: {
  concerns: string,
  personalImpact: string,
  location: { state: string; city: string; region: string },
  themeAnalysis: ThemeAnalysis,
  sources: Source[],
  representative: any
}): Promise<string> {
  const apiKey = getApiKey('ANTHROPIC_KEY');
  
  const repLastName = extractRepresentativeLastName(representative.name);
  const greeting = `Rep. ${repLastName},\n`;
  const greetingLength = greeting.length;
  const contentMaxLength = 300 - greetingLength;
  
  const POSTCARD_SYSTEM_PROMPT = `Write a congressional postcard that sounds like a real person, not a political speech.

EXACT FORMAT REQUIREMENTS (NON-NEGOTIABLE):
[content - start directly with the message content, NO greeting needed as it will be added automatically]

GREETING HANDLING:
- DO NOT include "Rep. Name," or "Dear Rep." - this will be added automatically
- Start directly with your message content
- DO NOT end with "Sincerely, [name]" or any signature line
- Keep the message focused and direct

🚨 ABSOLUTE LENGTH RULE (DO NOT BREAK):
- HARD MAXIMUM: ${contentMaxLength} characters for your content (including newlines). THIS IS A NON-NEGOTIABLE, CRITICAL REQUIREMENT.
- A greeting "Rep. ${repLastName}," will be automatically added, using ${greetingLength} characters
- Total final postcard will be exactly 300 characters maximum
- If your draft is even 1 character over ${contentMaxLength}, it will be rejected and not sent.
- TARGET: ${Math.max(contentMaxLength - 25, contentMaxLength - 20)}-${contentMaxLength - 5} characters for optimal space utilization
- Character counting includes newlines

⚠️ CRITICAL OUTPUT RULE:
- DO NOT include "[Character count: X]" or any character counting information in your response
- DO NOT include "(X characters)" or similar meta-information
- Character limits are for internal validation only - never output them
- Your response should ONLY contain the postcard message content

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
${sources.map((s, i) => `  ${i+1}. Title: ${s.headline}
     Outlet: ${s.outlet}
     Relevance: ${s.relevanceScore}/10 (${s.localPriority} priority)
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
  const rawText = result.content[0]?.text?.trim() || '';
  
  // Clean the AI response to remove any character count debugging info
  const text = cleanAIResponse(rawText);
  
  // Prepend the greeting to the AI-generated content
  const finalPostcard = greeting + text;
  
  return finalPostcard;
}

// Helper function to smart truncate text at the last period under the limit
function smartTruncate(text: string, maxLength: number = 300): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Find the last period that occurs before the character limit
  const truncatedText = text.substring(0, maxLength);
  const lastPeriodIndex = truncatedText.lastIndexOf('.');
  
  // If we found a period and it's not too early (at least 200 chars to avoid very short sentences)
  if (lastPeriodIndex > 200) {
    console.log(`Smart truncation: found period at position ${lastPeriodIndex}`);
    return text.substring(0, lastPeriodIndex + 1);
  }
  
  // Fallback to hard truncation
  console.log(`Hard truncation: no suitable period found, truncating at ${maxLength - 50} chars`);
  return text.substring(0, maxLength - 50) + '...';
}

async function shortenPostcard(originalPostcard: string, concerns: string, personalImpact: string, location: { state: string; city: string; region: string }, representative: any): Promise<string> {
  // Shortening API keys for better rate limit handling
  const shorteningKeys = ['ANTHROPIC_SHORTENING_KEY_1', 'ANTHROPIC_SHORTENING_KEY_2', 'ANTHROPIC_SHORTENING_KEY_3'];
  let apiKey: string | null = null;
  
  // Try each shortening key until we find one that works
  for (const keyName of shorteningKeys) {
    const key = getApiKey(keyName);
    if (key) {
      apiKey = key;
      console.log(`Using shortening key: ${keyName}`);
      break;
    }
  }
  
  // Fallback to main key if no shortening keys available
  if (!apiKey) {
    console.log('No dedicated shortening keys found, falling back to main ANTHROPIC_KEY');
    apiKey = getApiKey('ANTHROPIC_KEY');
  }
  
  // Extract greeting from original postcard to maintain consistency
  const repLastName = extractRepresentativeLastName(representative.name);
  const greeting = `Rep. ${repLastName},\n`;
  const greetingLength = greeting.length;
  
  // Remove existing greeting from original postcard for shortening
  const contentToShorten = originalPostcard.startsWith(greeting) 
    ? originalPostcard.substring(greetingLength)
    : originalPostcard;
  
  const contentMaxLength = 300 - greetingLength;
  
  const SHORTENING_PROMPT = `🚨 CRITICAL CHARACTER LIMIT WARNING 🚨
You are an expert at shortening congressional postcards while maintaining their impact and authenticity.

⚠️ MANDATORY TECHNICAL CONSTRAINT ⚠️
The postcard content ABSOLUTELY MUST BE UNDER ${contentMaxLength} characters. This is a HARD SYSTEM LIMIT - not a suggestion!

💀 CONSEQUENCES OF EXCEEDING LIMIT:
- Postcards over ${contentMaxLength} characters will be AUTOMATICALLY TRUNCATED
- This DESTROYS the message and makes it unreadable
- The postcard will be CUT OFF mid-sentence without warning
- THERE IS NO RECOVERY if you exceed this limit

🎯 YOUR MISSION: Shorten this postcard content to WELL UNDER ${contentMaxLength} characters while keeping it excellent.

STRATEGY (IN ORDER OF IMPORTANCE):
1. 🔥 PICK ONE STRONG POINT - Don't try to include everything
2. 🗑️ RUTHLESSLY CUT secondary arguments 
3. ❤️ Keep the personal connection and emotional impact
4. 🗣️ Maintain authentic, conversational voice
5. 📢 Include ONE clear call to action
6. ⛔ NO salutation/signature - "Rep. ${repLastName}," is added automatically

FORMAT REQUIREMENTS - NON-NEGOTIABLE:
- ⛔ DO NOT include "Rep. Name," or "Dear Rep." - added automatically
- ✅ Start DIRECTLY with your message content  
- ⛔ DO NOT end with "Sincerely, [name]" or any signature
- 🎯 Keep focused and direct

🚨 CRITICAL OUTPUT RULES - ZERO TOLERANCE:
- ⛔ DO NOT include "[Character count: X]" or counting info in response
- ⛔ DO NOT include "(X characters)" or meta-information  
- ⛔ Character limits are internal only - NEVER output them
- ✅ Response should ONLY contain the shortened message content
- 🔢 FINAL LENGTH MUST BE UNDER ${contentMaxLength} characters INCLUDING newlines

QUALITY STANDARDS:
- 💯 Shortened version must be complete and compelling standalone
- 🎯 One strong point beats multiple weak points
- 💬 Keep contractions and natural language
- 🚫 NEVER sacrifice authenticity for brevity

🚨 ABSOLUTE NON-NEGOTIABLE REQUIREMENTS 🚨
- ✅ MUST be WELL UNDER ${contentMaxLength} characters (aim for ${Math.max(200, contentMaxLength - 20)})
- ⛔ No salutation, no signature - just message content
- 💭 Must sound like a real person, not a form letter
- 📏 Total with greeting "Rep. ${repLastName}," (${greetingLength} chars) CANNOT exceed 300 chars
- ⚠️ IF IN DOUBT, MAKE IT SHORTER - truncation is worse than brevity

Original postcard content to shorten:
${contentToShorten}

🎯 WRITE THE SHORTENED VERSION - FOCUS ON THE MOST COMPELLING POINT:
⚠️ REMEMBER: MUST BE WELL UNDER ${contentMaxLength} CHARACTERS OR IT WILL BE DESTROYED BY TRUNCATION ⚠️`;

  try {
    console.log(`Attempting to shorten postcard from ${originalPostcard.length} to under 300 characters`);
    
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Shortening API error (${response.status}): ${errorText}`);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const rawShortenedText = result.content?.[0]?.text?.trim() || '';
    
    if (!rawShortenedText) {
      console.error('Shortening API returned empty response');
      throw new Error('Empty response from shortening API');
    }
    
    // Clean the AI response to remove any character count debugging info
    const shortenedText = cleanAIResponse(rawShortenedText);
    
    // Prepend the greeting to the shortened content
    const finalShortened = greeting + shortenedText;
    
    console.log(`✅ Successfully shortened postcard: ${originalPostcard.length} → ${finalShortened.length} characters`);
    return finalShortened;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Shortening API failed: ${errorMessage}`);
    // Return original postcard - caller will handle fallback
    throw error;
  }
}

async function generatePostcardAndSources({ zipCode, concerns, personalImpact, representative }: {
  zipCode: string,
  concerns: string,
  personalImpact: string,
  representative: any
}): Promise<{ postcard: string, sources: Source[], isFallbackPlaceholder?: boolean }> {
  try {
    console.log(`Generating postcard for "${concerns}" in ${zipCode}`);
    
    // Cache location lookup to avoid multiple API calls
    const location = await getLocationFromZip(zipCode);
    console.log(`Location resolved: ${location.city}, ${location.state}`);
    
    // Step 1: Analyze theme
    const themeAnalysis = await analyzeTheme({ concerns, personalImpact, location });
    console.log(`Theme identified: ${themeAnalysis.primaryTheme}`);
    
    // Step 2: Discover sources (Perplexity API search)
    const sources = await discoverSources(themeAnalysis, location);
    console.log(`Found ${sources.length} sources`);
    
    // Step 3: Draft postcard
    let postcard = await draftPostcard({ concerns, personalImpact, location, themeAnalysis, sources, representative });
    console.log(`Generated postcard: ${postcard.length} characters`);
    
    // Step 4: Shorten if needed (hard limit at 300 characters)
    if (postcard.length > 300) {
      console.log(`Postcard over 300 character limit (${postcard.length} chars), attempting shortening...`);
      
      try {
        const shortenedPostcard = await shortenPostcard(postcard, concerns, personalImpact, location, representative);
        console.log(`Shortened postcard: ${shortenedPostcard.length} characters`);
        
        // Use shortened version if it's actually shorter and under limit
        if (shortenedPostcard.length < postcard.length && shortenedPostcard.length <= 300) {
          postcard = shortenedPostcard;
          console.log(`✅ Shortening successful, using shortened version`);
        } else {
          console.log(`Shortening didn't improve length sufficiently, using smart truncation`);
          postcard = smartTruncate(postcard);
        }
      } catch (error) {
        // If shortening failed, try smart truncation as fallback
        console.log('Shortening API failed, using smart truncation fallback');
        postcard = smartTruncate(postcard);
      }
    }
    
    return { postcard, sources };
    
  } catch (error) {
    console.error("Error generating postcard:", error);
    
    // Friendly fallback message
    const fallbackMessage = "Canary just returned from a long flight and is resting, please draft the postcard yourself. Our robots will be happy to write it and send it on your behalf. Sorry for the inconvenience!";
    
    return { 
      postcard: fallbackMessage, 
      sources: [],
      isFallbackPlaceholder: true
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

    let finalResult = { postcard: '', sources: [] as Array<{description: string, url: string, dataPointCount: number}>, isFallbackPlaceholder: undefined as boolean | undefined };
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
      
      // Final validation: ensure postcard doesn't contain character count info
      const cleanedPostcard = cleanAIResponse(result.postcard);
      
      finalResult = {
        postcard: cleanedPostcard,
        sources: appSources.map(source => ({
          description: source.description,
          url: source.url,
          dataPointCount: 0
        })),
        isFallbackPlaceholder: result.isFallbackPlaceholder || false
      };
      
      console.log(`✅ Generated postcard (${cleanedPostcard.length} chars) with ${result.sources.length} sources`);
      
    } catch (error: any) {
      console.error('AI generation error:', error);
      generationStatus = 'error';
      apiStatusCode = 500;
      apiStatusMessage = error.message || 'AI generation failed';
      // Set friendly fallback message instead of leaving empty
      finalResult = {
        postcard: "Canary just returned from a long flight and is resting, please draft the postcard yourself. Our robots will be happy to write it and send it on your behalf. Sorry for the inconvenience!",
        sources: [],
        isFallbackPlaceholder: true
      };
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
    console.log(`✅ Generated postcard (${finalResult.postcard?.length || 0} chars) with ${finalResult.sources?.length || 0} sources${finalResult.isFallbackPlaceholder ? ' [FALLBACK]' : ''}`);
    
return new Response(JSON.stringify({ 
      draftMessage: finalResult.postcard,
      postcard: finalResult.postcard,
      sources: finalResult.sources,
      draftId: postcardDraft.id,
      isFallbackPlaceholder: finalResult.isFallbackPlaceholder || false
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error: any) {
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
