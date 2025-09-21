// Test the new Geocodio integration for zip code lookup

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
    console.log(`🗺️ Using cached location for ${zipCode}`);
    return commonZipMap[zipCode];
  }
  
  // Use Geocodio API for other zip codes
  try {
    console.log(`🌐 Looking up ${zipCode} with Geocodio API...`);
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
    
    const location = {
      state: addressComponents.state || 'Unknown',
      city: addressComponents.city || 'Unknown',
      region: `${addressComponents.city}, ${addressComponents.state}` || 'Unknown'
    };
    
    console.log(`✅ Geocodio lookup successful:`, location);
    return location;
    
  } catch (error) {
    console.error(`❌ Geocodio lookup failed for ${zipCode}:`, error.message);
    // Fallback to unknown values if API fails
    return { state: 'Unknown', city: 'Unknown', region: 'Unknown' };
  }
}

async function testGeocodioIntegration() {
  console.log('🧪 Testing Geocodio Integration');
  console.log('=' * 50);
  
  const testZipCodes = [
    // Common zip codes (should use cache)
    '90210', // Beverly Hills, CA
    '10001', // Manhattan, NY
    
    // New zip codes (should use Geocodio API)
    '94102', // San Francisco, CA
    '60614', // Chicago, IL
    '37201', // Nashville, TN
    '33139', // Miami Beach, FL
    
    // Invalid zip code
    '00000'
  ];
  
  for (const zipCode of testZipCodes) {
    console.log(`\n📍 Testing ZIP code: ${zipCode}`);
    console.log('-'.repeat(30));
    
    try {
      const location = await getLocationFromZip(zipCode);
      console.log(`🏙️ City: ${location.city}`);
      console.log(`🏛️ State: ${location.state}`);
      console.log(`🗺️ Region: ${location.region}`);
      
      if (location.state === 'Unknown') {
        console.log('⚠️ Location lookup failed or invalid zip code');
      } else {
        console.log('✅ Location lookup successful');
      }
      
    } catch (error) {
      console.error(`❌ Failed to lookup ${zipCode}:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🎯 Geocodio integration test complete!');
}

if (import.meta.main) {
  await testGeocodioIntegration();
}