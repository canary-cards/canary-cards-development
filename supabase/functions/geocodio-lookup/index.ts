import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const geocodioApiKey = Deno.env.get('GeoCodioKey');
    if (!geocodioApiKey) {
      console.error('GeoCodioKey environment variable not set');
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
    }> = [];
    
    // Extract all legislators (representatives and senators)
    if (result.fields?.congressional_districts) {
      result.fields.congressional_districts.forEach((cd) => {
        cd.current_legislators.forEach((legislator, index) => {
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
            address: legislator.contact?.address
          });
        });
      });
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