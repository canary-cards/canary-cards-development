// Test the new postcard generation system with shortening capability
// This tests the actual Supabase function logic

interface Source {
  url: string;
  outlet: string;
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

// Copy the actual functions from the Supabase function for testing
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

function getLocationFromZip(zipCode: string): { state: string; city: string; region: string } {
  const zipMap: { [key: string]: { state: string; city: string; region: string } } = {
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
  
  return zipMap[zipCode] || { state: 'Unknown', city: 'Unknown', region: 'Unknown' };
}

async function analyzeTheme({ concerns, personalImpact, zipCode }: {
  concerns: string,
  personalImpact: string,
  zipCode: string
}): Promise<ThemeAnalysis> {
  const apiKey = getApiKey('anthropickey');
  const location = getLocationFromZip(zipCode);
  
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
  const location = getLocationFromZip(zipCode);
  
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

  const result = await response.json();
  const searchContent = result.choices[0]?.message?.content || '';
  const citations = result.citations || [];
  
  const sources: Source[] = [];
  
  for (const [index, citationUrl] of citations.entries()) {
    const url = citationUrl as string;
    
    // Extract title from URL
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1] || urlParts[urlParts.length - 2];
    let title = url;
    if (lastPart && lastPart !== '') {
      title = lastPart
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\.(html|htm|php)$/i, '')
        .replace(/\b\w/g, l => l.toUpperCase());
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
      summary: summary.substring(0, 250) + (summary.length > 250 ? '...' : '')
    });
  }
  
  return sources.slice(0, 4); // Return top 4 sources
}

async function draftPostcard({ concerns, personalImpact, zipCode, themeAnalysis, sources }: {
  concerns: string,
  personalImpact: string,
  zipCode: string,
  themeAnalysis: ThemeAnalysis,
  sources: Source[]
}): Promise<string> {
  const apiKey = getApiKey('anthropickey');
  const location = getLocationFromZip(zipCode);
  
  const POSTCARD_SYSTEM_PROMPT = `Write a congressional postcard that sounds like a real person, not a political speech.

EXACT FORMAT REQUIREMENTS (NON-NEGOTIABLE):
Rep. [LastName],
[content - do NOT repeat "Rep." or "Dear Rep." here]
Sincerely, [SenderName]

LENGTH REQUIREMENTS:
- TARGET: 275-280 characters (optimal space utilization)
- HARD MAXIMUM: 290 characters (NEVER EXCEED)
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

Write the complete postcard following these guidelines exactly.`;

  const today = new Date().toISOString().split('T')[0];
  const context = `
Today's date: ${today}
User concern: ${concerns}
Personal impact: ${personalImpact || ''}
Location: ${location.city}, ${location.state}
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
  const location = getLocationFromZip(zipCode);
  
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
      console.log(`🔥 Postcard too long (${postcard.length} chars), shortening...`);
      const shortenedPostcard = await shortenPostcard(postcard, concerns, personalImpact, zipCode);
      console.log(`✂️ Shortened postcard: ${shortenedPostcard.length} characters`);
      
      // Use shortened version if it's actually shorter and under limit
      if (shortenedPostcard.length < postcard.length && shortenedPostcard.length <= 290) {
        console.log(`✅ Using shortened version`);
        postcard = shortenedPostcard;
      } else {
        // If shortening failed, try basic truncation as last resort
        console.log('⚠️ Shortening API failed, using truncation fallback');
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
    const { state } = getLocationFromZip(zipCode);
    const fallbackPostcard = `Rep. Smith,

${personalImpact} Please address ${concerns} affecting ${state} families.

Sincerely, Concerned Citizen`;

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

// Test cases - some designed to generate long postcards
const testCases = [
  {
    concerns: "housing speculation driving up rent prices while local families are being displaced and corporate landlords are buying up affordable housing units",
    personalImpact: "My rent increased 40% this year and I might have to move out of state, leaving my job and my elderly parents behind",
    zipCode: "90210",
    description: "Complex housing issue (should be long)"
  },
  {
    concerns: "gun violence in schools",
    personalImpact: "My daughter is afraid to go to class",
    zipCode: "78701", 
    description: "Simple concern (should be short)"
  },
  {
    concerns: "healthcare costs including prescription drugs, insurance premiums, and hospital bills are bankrupting middle-class families across the country",
    personalImpact: "I pay $800/month for insulin and my insurance won't cover my specialist visits, so I'm choosing between medication and groceries",
    zipCode: "10001",
    description: "Multiple healthcare issues (should be long)"
  }
];

async function testShorteningSystem() {
  console.log('🧪 Testing Postcard Generation with Shortening System');
  console.log('=' * 60);
  
  for (const [index, testCase] of testCases.entries()) {
    console.log(`\n📝 TEST ${index + 1}: ${testCase.description}`);
    console.log(`🎯 Concern: ${testCase.concerns.substring(0, 50)}...`);
    console.log(`💔 Impact: ${testCase.personalImpact.substring(0, 50)}...`);
    console.log(`📍 Location: ${testCase.zipCode}`);
    console.log('-'.repeat(50));
    
    try {
      const result = await generatePostcardAndSources({
        zipCode: testCase.zipCode,
        concerns: testCase.concerns,
        personalImpact: testCase.personalImpact
      });
      
      console.log('\n✉️ FINAL POSTCARD:');
      console.log(result.postcard);
      console.log(`\n📏 Final length: ${result.postcard.length} characters`);
      console.log(`✅ Under 290 chars: ${result.postcard.length <= 290 ? 'YES' : 'NO'}`);
      console.log(`📚 Sources found: ${result.sources.length}`);
      
      if (result.sources.length > 0) {
        console.log('\n🔍 Sources:');
        result.sources.forEach((source, i) => {
          console.log(`  ${i+1}. ${source.outlet}: ${source.summary.substring(0, 60)}...`);
        });
      }
      
    } catch (error) {
      console.error(`❌ Test ${index + 1} failed:`, error.message);
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

if (import.meta.main) {
  await testShorteningSystem();
}