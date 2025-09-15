import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { searchAddressAutocomplete, getPlaceDetails } from '@/services/googlePlaces';
import { lookupRepresentatives } from '@/services/geocodio';

export const ApiTestComponent = () => {
  const [geocodioZip, setGeocodioZip] = useState('');
  const [geocodioResults, setGeocodioResults] = useState<any>(null);
  const [geocodioLoading, setGeocodioLoading] = useState(false);

  const [placesQuery, setPlacesQuery] = useState('');
  const [placesResults, setPlacesResults] = useState<any>(null);
  const [placesLoading, setPlacesLoading] = useState(false);

  const [selectedPlaceId, setSelectedPlaceId] = useState('');
  const [placeDetails, setPlaceDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const testGeocodio = async () => {
    if (!geocodioZip) return;
    
    setGeocodioLoading(true);
    try {
      const result = await lookupRepresentatives(geocodioZip);
      setGeocodioResults(result);
      console.log('Geocodio results:', result);
    } catch (error) {
      console.error('Geocodio test error:', error);
      setGeocodioResults({ error: error.message });
    }
    setGeocodioLoading(false);
  };

  const testGooglePlaces = async () => {
    if (!placesQuery) return;
    
    setPlacesLoading(true);
    try {
      const result = await searchAddressAutocomplete(placesQuery);
      setPlacesResults(result);
      console.log('Google Places results:', result);
    } catch (error) {
      console.error('Google Places test error:', error);
      setPlacesResults({ error: error.message });
    }
    setPlacesLoading(false);
  };

  const testPlaceDetails = async () => {
    if (!selectedPlaceId) return;
    
    setDetailsLoading(true);
    try {
      const result = await getPlaceDetails(selectedPlaceId);
      setPlaceDetails(result);
      console.log('Place details results:', result);
    } catch (error) {
      console.error('Place details test error:', error);
      setPlaceDetails({ error: error.message });
    }
    setDetailsLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">API Test Component</h1>
      
      {/* Geocodio Test */}
      <Card>
        <CardHeader>
          <CardTitle>Geocodio API Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter ZIP code (e.g., 90210)"
              value={geocodioZip}
              onChange={(e) => setGeocodioZip(e.target.value)}
            />
            <Button onClick={testGeocodio} disabled={geocodioLoading}>
              {geocodioLoading ? 'Testing...' : 'Test Geocodio'}
            </Button>
          </div>
          
          {geocodioResults && (
            <div className="bg-gray-100 p-4 rounded">
              <h4 className="font-semibold">Results:</h4>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(geocodioResults, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Places Autocomplete Test */}
      <Card>
        <CardHeader>
          <CardTitle>Google Places Autocomplete Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter address (e.g., 123 Main St)"
              value={placesQuery}
              onChange={(e) => setPlacesQuery(e.target.value)}
            />
            <Button onClick={testGooglePlaces} disabled={placesLoading}>
              {placesLoading ? 'Testing...' : 'Test Places'}
            </Button>
          </div>
          
          {placesResults && (
            <div className="bg-gray-100 p-4 rounded">
              <h4 className="font-semibold">Results:</h4>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(placesResults, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Places Details Test */}
      <Card>
        <CardHeader>
          <CardTitle>Google Places Details Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter place ID from above results"
              value={selectedPlaceId}
              onChange={(e) => setSelectedPlaceId(e.target.value)}
            />
            <Button onClick={testPlaceDetails} disabled={detailsLoading}>
              {detailsLoading ? 'Testing...' : 'Test Details'}
            </Button>
          </div>
          
          {placeDetails && (
            <div className="bg-gray-100 p-4 rounded">
              <h4 className="font-semibold">Results:</h4>
              <pre className="text-sm overflow-auto">
                {JSON.stringify(placeDetails, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};