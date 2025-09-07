import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { input, types = 'address', componentRestrictions, zipCode } = await req.json()
    
    console.log('Received request:', { input, types, componentRestrictions, zipCode })

    const apiKey = Deno.env.get('Google Places Api')
    if (!apiKey) {
      console.error('Google Places API key not found')
      throw new Error('Google Places API key not found')
    }

    console.log('API Key found, making request to new Google Places API')

    // Use the new Places API (New) with correct field structure
    const url = 'https://places.googleapis.com/v1/places:autocomplete'
    
    // Build the request body with proper location bias for zip code
    const requestBody: any = {
      input: input,
      includedPrimaryTypes: ['street_address', 'route', 'subpremise', 'premise'],
      includedRegionCodes: ['US'],
      languageCode: 'en',
      regionCode: 'US',
      includeQueryPredictions: false
    }

    // If zip code is provided, get coordinates and use for location bias
    if (zipCode) {
      try {
        // Get coordinates for the zip code using Geocodio API
        const geocodioKey = Deno.env.get('GeoCodioKey')
        if (geocodioKey) {
          console.log('Getting coordinates for zip code:', zipCode)
          const geocodioResponse = await fetch(`https://api.geocod.io/v1.9/geocode?q=${zipCode}&api_key=${geocodioKey}`)
          const geocodioData = await geocodioResponse.json()
          
          if (geocodioData.results && geocodioData.results.length > 0) {
            const location = geocodioData.results[0].location
            console.log('Found coordinates:', location)
            
            // Use circle location bias with actual coordinates
            requestBody.locationBias = {
              circle: {
                center: {
                  latitude: location.lat,
                  longitude: location.lng
                },
                radius: 12500.0 // 12.5km radius around the zip code center
              }
            }
          }
        }
      } catch (geocodioError) {
        console.warn('Failed to get coordinates for zip code:', geocodioError)
        // Fall back to including zip code in input
        requestBody.input = `${input}, ${zipCode}`
      }
    }

    console.log('New API request body:', requestBody)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey
      },
      body: JSON.stringify(requestBody)
    })
    
    const data = await response.json()
    console.log('New API response:', { status: response.status, data })
    
    if (!response.ok) {
      console.error('New API error:', data)
      throw new Error(`Google Places API error: ${response.status} - ${JSON.stringify(data)}`)
    }

    // Transform the new API response to match the expected format
    const transformedData = {
      predictions: data.suggestions?.map((suggestion: any) => ({
        place_id: suggestion.placePrediction?.place || `temp_${Date.now()}_${Math.random()}`,
        description: suggestion.placePrediction?.text?.text || suggestion.description || '',
        structured_formatting: {
          main_text: suggestion.placePrediction?.structuredFormat?.mainText?.text || suggestion.placePrediction?.text?.text || '',
          secondary_text: suggestion.placePrediction?.structuredFormat?.secondaryText?.text || ''
        }
      })) || [],
      status: 'OK'
    }

    console.log('Final response data:', transformedData)

    return new Response(
      JSON.stringify(transformedData),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        predictions: [],
        status: 'ERROR'
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})