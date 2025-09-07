import { supabase } from "@/integrations/supabase/client";

export interface GeocodioResponse {
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

export async function lookupRepresentatives(zipCode: string) {
  try {
    const { data, error } = await supabase.functions.invoke('geocodio-lookup', {
      body: { zipCode, includeSenatorsAndReps: false }
    });

    if (error) {
      console.error('Geocodio lookup error:', error);
      throw new Error('Failed to fetch representatives');
    }

    return data;
  } catch (error) {
    console.error('Geocodio API error:', error);
    throw new Error('Unable to lookup representatives. Please try again.');
  }
}

export async function lookupRepresentativesAndSenators(zipCode: string) {
  try {
    const { data, error } = await supabase.functions.invoke('geocodio-lookup', {
      body: { zipCode, includeSenatorsAndReps: true }
    });

    if (error) {
      console.error('Geocodio lookup error:', error);
      throw new Error('Failed to fetch representatives and senators');
    }

    return data;
  } catch (error) {
    console.error('Geocodio API error:', error);
    throw new Error('Unable to lookup representatives and senators. Please try again.');
  }
}


// Address search functions removed - now using Google Places API
// See src/services/googlePlaces.ts for address autocomplete functionality