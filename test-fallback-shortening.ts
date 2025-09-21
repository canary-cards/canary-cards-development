// Test the updated fallback shortening logic

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
  };
  
  return zipMap[zipCode] || { state: 'Unknown', city: 'Unknown', region: 'Unknown' };
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

// Simulate the NEW fallback logic with shortening
async function generateFallbackPostcardWithShortening({ zipCode, concerns, personalImpact }: {
  zipCode: string,
  concerns: string,
  personalImpact: string
}): Promise<{ postcard: string, sources: Array<any> }> {
  
  console.log("🔄 Simulating API failure - using fallback path with shortening...");
  
  // Fallback simple postcard (this is what happens when APIs fail)
  const { state } = getLocationFromZip(zipCode);
  let fallbackPostcard = `Rep. Smith,

${personalImpact} Please address ${concerns} affecting ${state} families.

Sincerely, Concerned Citizen`;

  console.log(`📏 Initial fallback postcard: ${fallbackPostcard.length} characters`);

  // Apply shortening to fallback postcard if needed
  if (fallbackPostcard.length > 290) {
    console.log(`🔥 Fallback postcard too long (${fallbackPostcard.length} chars), shortening...`);
    try {
      const shortenedFallback = await shortenPostcard(fallbackPostcard, concerns, personalImpact, zipCode);
      console.log(`✂️ Got shortened version: ${shortenedFallback.length} characters`);
      
      if (shortenedFallback.length < fallbackPostcard.length && shortenedFallback.length <= 290) {
        fallbackPostcard = shortenedFallback;
        console.log(`✅ Used shortened fallback: ${fallbackPostcard.length} characters`);
      } else {
        // Basic truncation as last resort
        const lines = fallbackPostcard.split('\n');
        if (lines.length >= 3) {
          fallbackPostcard = [lines[0], lines[1].substring(0, 150), lines[lines.length - 1]].join('\n');
          console.log(`⚠️ Used truncated fallback: ${fallbackPostcard.length} characters`);
        }
      }
    } catch (shorteningError) {
      console.error("❌ Fallback shortening failed:", shorteningError.message);
      // Basic truncation as last resort
      const lines = fallbackPostcard.split('\n');
      if (lines.length >= 3) {
        fallbackPostcard = [lines[0], lines[1].substring(0, 150), lines[lines.length - 1]].join('\n');
        console.log(`⚠️ Used truncated fallback after shortening error: ${fallbackPostcard.length} characters`);
      }
    }
  } else {
    console.log(`✅ Fallback postcard already under 290 characters`);
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

async function testFallbackShortening() {
  console.log('🧪 Testing FALLBACK SHORTENING (New Logic)');
  console.log('=' * 60);
  
  // Test cases designed to create long fallback postcards
  const testCases = [
    {
      concerns: "housing speculation driving up rent prices while local families are being displaced and corporate landlords are buying up affordable housing units and driving out long-term residents",
      personalImpact: "My rent increased 40% this year and I might have to move out of state, leaving my job and my elderly parents behind because I can't afford to live here anymore",
      zipCode: "90210",
      description: "Very long housing concern"
    },
    {
      concerns: "healthcare costs including prescription drugs, insurance premiums, and hospital bills are bankrupting middle-class families across the country while pharmaceutical companies make record profits",
      personalImpact: "I pay $800/month for insulin and my insurance won't cover my specialist visits, so I'm choosing between medication and groceries every month",
      zipCode: "10001",
      description: "Very long healthcare concern"
    }
  ];
  
  for (const [index, testCase] of testCases.entries()) {
    console.log(`\n📝 TEST ${index + 1}: ${testCase.description}`);
    console.log(`🎯 Concern: ${testCase.concerns.substring(0, 60)}...`);
    console.log(`💔 Impact: ${testCase.personalImpact.substring(0, 60)}...`);
    console.log(`📍 Location: ${testCase.zipCode}`);
    console.log('-'.repeat(60));
    
    try {
      const result = await generateFallbackPostcardWithShortening({
        zipCode: testCase.zipCode,
        concerns: testCase.concerns,
        personalImpact: testCase.personalImpact
      });
      
      console.log('\n✉️ FINAL FALLBACK POSTCARD:');
      console.log(result.postcard);
      console.log(`\n📏 Final length: ${result.postcard.length} characters`);
      console.log(`✅ Under 290 chars: ${result.postcard.length <= 290 ? 'YES' : 'NO'}`);
      
      // Test format compliance
      const lines = result.postcard.split('\n');
      const hasRepLine = lines[0]?.startsWith('Rep.');
      const hasSincerelyLine = lines[lines.length - 1]?.startsWith('Sincerely,');
      
      console.log(`\n✅ Format check:`);
      console.log(`   Rep. line: ${hasRepLine ? 'YES' : 'NO'}`);
      console.log(`   Sincerely line: ${hasSincerelyLine ? 'YES' : 'NO'}`);
      
    } catch (error) {
      console.error(`❌ Test ${index + 1} failed:`, error.message);
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

if (import.meta.main) {
  await testFallbackShortening();
}