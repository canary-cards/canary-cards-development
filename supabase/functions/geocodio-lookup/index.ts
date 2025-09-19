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

// Helper function to get real biographical information from Congress API
async function getRealBiographicalInfo(firstName: string, lastName: string, state: string, party: string, type: string): Promise<string> {
  console.log(`Getting real bio for ${firstName} ${lastName} (${party}) from ${state}`);
  
  try {
    const congressApiKey = Deno.env.get('CONGRESS_API_KEY');
    if (!congressApiKey) {
      console.log('Congress API key not available, using fallback bio');
      return getFallbackBio(firstName, lastName, state, party, type);
    }

    // Search for the member in Congress API
    const searchUrl = `https://api.congress.gov/v3/member?format=json&api_key=${congressApiKey}&limit=250`;
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      console.log(`Congress API error: ${response.status}, using fallback bio`);
      return getFallbackBio(firstName, lastName, state, party, type);
    }
    
    const data = await response.json();
    const members = data.members || [];
    
    // Find matching member by name and state
    const matchingMember = members.find((member: any) => {
      const memberFirstName = member.name?.split(' ')[0]?.toLowerCase();
      const memberLastName = member.name?.split(' ').pop()?.toLowerCase();
      const memberState = member.state;
      
      return memberFirstName === firstName.toLowerCase() && 
             memberLastName === lastName.toLowerCase() && 
             memberState === state;
    });
    
    if (matchingMember) {
      // Get detailed member information
      const memberUrl = `${matchingMember.url}?format=json&api_key=${congressApiKey}`;
      const memberResponse = await fetch(memberUrl);
      
      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        const member = memberData.member;
        
        // Build biographical information from real data
        let bio = '';
        
        // Add current terms info
        if (member.terms && member.terms.item && member.terms.item.length > 0) {
          const currentTerm = member.terms.item[0]; // Most recent term
          if (currentTerm.chamber) {
            bio += `Currently serves in the ${currentTerm.chamber === 'House of Representatives' ? 'House' : 'Senate'}. `;
          }
        }
        
        // Add party affiliation
        if (member.partyHistory && member.partyHistory.item && member.partyHistory.item.length > 0) {
          const currentParty = member.partyHistory.item[0];
          if (currentParty.partyName && currentParty.partyName !== party) {
            bio += `Member of the ${currentParty.partyName} Party. `;
          }
        }
        
        // Add served since information
        if (member.depiction && member.depiction.attribution) {
          bio += `${member.depiction.attribution}. `;
        }
        
        // Add any leadership positions or notable roles
        if (member.leadership && member.leadership.item && member.leadership.item.length > 0) {
          const leadership = member.leadership.item[0];
          if (leadership.type) {
            bio += `${leadership.type}. `;
          }
        }
        
        if (bio.trim()) {
          console.log(`Found real bio: ${bio.trim()}`);
          return bio.trim();
        }
      }
    }
    
    console.log('No matching member found in Congress API, using fallback bio');
    return getFallbackBio(firstName, lastName, state, party, type);
    
  } catch (error) {
    console.error('Error fetching from Congress API:', error);
    return getFallbackBio(firstName, lastName, state, party, type);
  }
}

// Fallback biographical information when real data isn't available
function getFallbackBio(firstName: string, lastName: string, state: string, party: string, type: string): string {
  const title = type === 'representative' ? 'Representative' : 'Senator';
  const chamber = type === 'representative' ? 'House' : 'Senate';
  
  // More personalized fallback based on actual person
  const fallbackBios = [
    `${title} from ${state}. Serves constituents in the U.S. ${chamber} as a member of the ${party} party.`,
    `Elected ${title} representing ${state}. Active in legislative work and constituent services.`,
    `${party} ${title} from ${state}. Focuses on issues important to ${state} residents.`
  ];
  
  const randomBio = fallbackBios[Math.floor(Math.random() * fallbackBios.length)];
  console.log(`Using fallback bio: ${randomBio}`);
  return randomBio;
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
          // Get real biographical information
          const bio = await getRealBiographicalInfo(
            legislator.bio.first_name,
            legislator.bio.last_name,
            result.address_components.state,
            legislator.bio.party,
            legislator.type
          );

          const legislatorData = {
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
          };

          console.log('Adding legislator with bio:', legislatorData);
          allLegislators.push(legislatorData);
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