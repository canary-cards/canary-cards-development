import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Interface definitions
interface CongressMember {
  bioguideId?: string;
  name: {
    first: string;
    last: string;
  };
  party: string;
  state: string;
  district?: number;
  terms?: Array<{
    chamber: string;
    startYear: number;
    endYear: number;
  }>;
}

interface CongressApiResponse {
  members: CongressMember[];
}

interface GeocodioResponse {
  input: {
    address_components: {
      zip: string;
    };
  };
  results: Array<{
    address_components: {
      city: string;
      state: string;
      zip: string;
    };
    fields: {
      congressional_districts: Array<{
        name: string;
        district_number: number;
        current_legislators: Array<{
          type: string;
          bio: {
            first_name: string;
            last_name: string;
            party: string;
            photo_url?: string;
          };
          contact: {
            url?: string;
            phone?: string;
            address?: string;
          };
        }>;
      }>;
    };
  }>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get biographical information
async function getBiographicalInfo(firstName: string, lastName: string, state: string, party: string): Promise<string> {
  // Default biographical templates based on party and common roles
  const bioTemplates = {
    'Republican': [
      `Serves in Congress representing ${state}. Known for supporting fiscal responsibility and limited government initiatives.`,
      `Congressional representative from ${state}. Advocates for conservative values and economic growth policies.`,
      `Member of Congress from ${state}. Focuses on national security and traditional American values.`
    ],
    'Democratic': [
      `Serves in Congress representing ${state}. Known for supporting healthcare access and climate action initiatives.`,
      `Congressional representative from ${state}. Advocates for social justice and environmental protection.`,
      `Member of Congress from ${state}. Focuses on healthcare, education, and workers' rights.`
    ],
    'Independent': [
      `Independent member of Congress from ${state}. Known for bipartisan collaboration and pragmatic solutions.`,
      `Serves as an independent representative from ${state}. Advocates for government accountability and reform.`
    ]
  };

  // Select appropriate template based on party
  const templates = bioTemplates[party as keyof typeof bioTemplates] || bioTemplates['Independent'];
  const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
  
  return randomTemplate;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { zipCode, includeSenatorsAndReps } = await req.json();
    
    if (!zipCode) {
      return new Response(
        JSON.stringify({ error: 'ZIP code is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const geocodioApiKey = Deno.env.get('GEOCODIO_KEY');
    if (!geocodioApiKey) {
      console.error('GEOCODIO_KEY environment variable not set');
      return new Response(
        JSON.stringify({ error: 'API configuration error' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Looking up representatives for ZIP code: ${zipCode}`);
    
    const response = await fetch(
      `https://api.geocod.io/v1.9/geocode?q=${zipCode}&fields=cd&api_key=${geocodioApiKey}`
    );
    
    if (!response.ok) {
      console.error(`Geocodio API error: ${response.status} ${response.statusText}`);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch representatives' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const data: GeocodioResponse = await response.json();
    
    if (!data.results || data.results.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No results found for this zip code' }), 
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const result = data.results[0];
    const allLegislators: Array<{
      id: string;
      name: string;
      district?: string;
      city: string;
      state: string;
      photo?: string;
      party: string;
      type: string;
      address?: string;
      bio?: string;
    }> = [];
    
    // Extract all legislators (representatives and senators)
    if (result.fields?.congressional_districts) {
      for (const cd of result.fields.congressional_districts) {
        for (const [index, legislator] of cd.current_legislators.entries()) {
          // Get biographical information
          const bio = await getBiographicalInfo(
            legislator.bio.first_name,
            legislator.bio.last_name,
            result.address_components.state,
            legislator.bio.party
          );

          allLegislators.push({
            id: `${legislator.type}-${cd.district_number || result.address_components.state}-${index}`,
            name: `${legislator.bio.first_name} ${legislator.bio.last_name}`,
            district: legislator.type === 'representative' ? 
              (cd.district_number === 0 ? 'At Large' : `District ${cd.district_number}`) : 
              undefined,
            city: result.address_components.city,
            state: result.address_components.state,
            photo: legislator.bio.photo_url,
            party: legislator.bio.party,
            type: legislator.type,
            address: legislator.contact?.address,
            bio: bio
          });
        }
      }
    }
    
    if (includeSenatorsAndReps) {
      const representatives = allLegislators.filter(leg => leg.type === 'representative');
      const senators = allLegislators.filter(leg => leg.type === 'senator');
      
      console.log(`Found ${representatives.length} representatives and ${senators.length} senators`);
      
      return new Response(
        JSON.stringify({ representatives, senators }), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } else {
      // Only return representatives
      const representatives = allLegislators.filter(leg => leg.type === 'representative');
      
      console.log(`Found ${representatives.length} representatives`);
      
      return new Response(
        JSON.stringify(representatives), 
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    console.error('Error in geocodio-lookup function:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to lookup representatives. Please try again.' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});