// Test just the shortening function with a long postcard

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

async function testShorteningFunction() {
  console.log('🧪 Testing SHORTENING FUNCTION specifically');
  console.log('=' * 60);
  
  // Create a deliberately long postcard to test shortening
  const longPostcard = `Rep. Garcia,

I'm deeply concerned about the rising costs of healthcare, including prescription drugs that have tripled in price, insurance premiums that eat up my entire paycheck, hospital bills that are bankrupting families like mine, and the lack of transparency in medical billing. My family in Los Angeles can't afford basic medical care anymore, and we're forced to choose between medication and groceries. This affects millions of California families who are struggling with the same impossible choices every day.

Sincerely, Maria Santos`;

  const testCase = {
    concerns: "healthcare costs including prescription drugs and insurance premiums",
    personalImpact: "My family can't afford basic medical care and we choose between medication and groceries",
    zipCode: "90210"
  };

  console.log(`\n📏 Original postcard length: ${longPostcard.length} characters`);
  console.log(`🔥 Over limit by: ${longPostcard.length - 290} characters`);
  
  console.log('\n📝 ORIGINAL POSTCARD:');
  console.log(longPostcard);
  
  console.log('\n✂️ SHORTENING...');
  
  try {
    const shortenedPostcard = await shortenPostcard(
      longPostcard, 
      testCase.concerns, 
      testCase.personalImpact, 
      testCase.zipCode
    );
    
    console.log('\n✉️ SHORTENED POSTCARD:');
    console.log(shortenedPostcard);
    console.log(`\n📏 Shortened length: ${shortenedPostcard.length} characters`);
    console.log(`✅ Under 290 chars: ${shortenedPostcard.length <= 290 ? 'YES' : 'NO'}`);
    console.log(`📉 Reduction: ${longPostcard.length - shortenedPostcard.length} characters`);
    console.log(`🎯 Percentage reduction: ${Math.round((1 - shortenedPostcard.length / longPostcard.length) * 100)}%`);
    
    // Test format compliance
    const lines = shortenedPostcard.split('\n');
    const hasRepLine = lines[0]?.startsWith('Rep.');
    const hasSincerelyLine = lines[lines.length - 1]?.startsWith('Sincerely,');
    
    console.log(`\n✅ Format check:`);
    console.log(`   Rep. line: ${hasRepLine ? 'YES' : 'NO'}`);
    console.log(`   Sincerely line: ${hasSincerelyLine ? 'YES' : 'NO'}`);
    console.log(`   Total lines: ${lines.length}`);
    
  } catch (error) {
    console.error(`❌ Shortening failed:`, error.message);
  }
}

if (import.meta.main) {
  await testShorteningFunction();
}