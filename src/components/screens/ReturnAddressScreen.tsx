import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { useAppContext } from '../../context/AppContext';
import { MapPin, ArrowLeft, ArrowRight, Home, Plus, Minus } from 'lucide-react';
import { searchAddressAutocomplete, getPlaceDetails, GooglePlacesAddressPrediction } from '../../services/googlePlaces';
import { capitalizeName } from '../../lib/utils';

// Interface removed - now using GooglePlacesAddressPrediction from service

export function ReturnAddressScreen() {
  const { state: appState, dispatch } = useAppContext();
  
  // Initialize state with existing data from app context
  const existingUserInfo = appState.postcardData.userInfo;
  const [fullName, setFullName] = useState(existingUserInfo?.fullName || '');
  const [streetAddress, setStreetAddress] = useState(() => {
    // Reconstruct the full address if we have separate components
    if (existingUserInfo?.streetAddress && existingUserInfo?.city && existingUserInfo?.state) {
      return `${existingUserInfo.streetAddress}, ${existingUserInfo.city}, ${existingUserInfo.state} ${existingUserInfo.zipCode || ''}`.trim();
    }
    return existingUserInfo?.streetAddress || '';
  });
  const [apartmentUnit, setApartmentUnit] = useState(() => {
    // Extract apartment info if it exists in the stored address
    if (existingUserInfo?.streetAddress) {
      const aptMatch = existingUserInfo.streetAddress.match(/,\s*(Apt|Unit|Suite|#)\s*(.+)$/i);
      return aptMatch ? `${aptMatch[1]} ${aptMatch[2]}` : '';
    }
    return '';
  });
  const [showApartmentField, setShowApartmentField] = useState(() => {
    // Check if existing address might contain apartment info
    const hasApartmentInfo = existingUserInfo?.streetAddress && 
      (existingUserInfo.streetAddress.includes('Apt') || 
       existingUserInfo.streetAddress.includes('Unit') || 
       existingUserInfo.streetAddress.includes('Suite') ||
       existingUserInfo.streetAddress.includes('#'));
    return hasApartmentInfo || false;
  });
  const [addressSuggestions, setAddressSuggestions] = useState<GooglePlacesAddressPrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const zipCode = appState.postcardData.zipCode || '';

  // Save data to context as user types (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (fullName.trim() || streetAddress.trim()) {
        // Parse address components for temporary storage
        const { city, state, zipCode: parsedZip } = parseAddressComponents(streetAddress);
        
        // Only save if we have meaningful data
        const userInfo = {
          fullName: fullName.trim(),
          streetAddress: streetAddress.trim(),
          city: city || existingUserInfo?.city || '',
          state: state || existingUserInfo?.state || '',
          zipCode: parsedZip || zipCode || existingUserInfo?.zipCode || ''
        };

        dispatch({ 
          type: 'UPDATE_POSTCARD_DATA', 
          payload: { userInfo }
        });
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [fullName, streetAddress, dispatch, existingUserInfo, zipCode]);

  const handleAddressSearch = async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const suggestions = await searchAddressAutocomplete(query, zipCode);
      setAddressSuggestions(suggestions);
      setShowSuggestions(suggestions.length > 0);
    } catch (error) {
      console.error('Address search failed:', error);
      setAddressSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddressInputChange = (value: string) => {
    setStreetAddress(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Show suggestions dropdown immediately with feedback
    setShowSuggestions(true);
    
    // Clear previous suggestions if input is too short
    if (value.length < 3) {
      setAddressSuggestions([]);
      setIsSearching(false);
      return;
    }
    
    // Fast search for 3+ characters (150ms delay)
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      handleAddressSearch(value);
    }, 150);
  };

  const handleSuggestionClick = async (suggestion: GooglePlacesAddressPrediction) => {
    // Remove country from description if present (ends with ", USA")
    let formattedAddress = suggestion.description;
    if (formattedAddress.endsWith(', USA')) {
      formattedAddress = formattedAddress.replace(', USA', '');
    }
    
    setStreetAddress(formattedAddress);
    setShowSuggestions(false);
  };

  // Auto-expand textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(48, textarea.scrollHeight) + 'px';
    }
  }, [streetAddress]);

  // Parse address components from full address string
  const parseAddressComponents = (fullAddress: string) => {
    const parts = fullAddress.split(', ');
    let city = '';
    let state = '';
    let zipCode = '';

    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      const secondLastPart = parts[parts.length - 2];
      
      // Check if last part contains state and zip (e.g., "IL 62701")
      const stateZipMatch = lastPart.match(/^([A-Z]{2})\s+(\d{5}(-\d{4})?)$/);
      if (stateZipMatch) {
        state = stateZipMatch[1];
        zipCode = stateZipMatch[2];
        city = secondLastPart;
      } else if (parts.length >= 3) {
        // If format is different, try to extract from available parts
        city = secondLastPart;
        state = lastPart;
      }
    }

    return { city, state, zipCode };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim() || !streetAddress.trim()) {
      return;
    }

    // Parse city, state, zip from the full address
    const { city, state, zipCode: parsedZip } = parseAddressComponents(streetAddress);

    // Extract just the street portion (remove city, state, zip from the address)
    let cleanStreetAddress = streetAddress.trim();
    
    // Remove the city, state, zip portion if it exists
    if (city && state) {
      const cityStatePattern = new RegExp(`,\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},\\s*${state}.*$`, 'i');
      cleanStreetAddress = cleanStreetAddress.replace(cityStatePattern, '');
    }

    // Combine clean street address and apartment/unit if provided
    const finalStreetAddress = apartmentUnit.trim() 
      ? `${cleanStreetAddress}, ${apartmentUnit.trim()}`
      : cleanStreetAddress;

    const userInfo = {
      fullName: fullName.trim(),
      streetAddress: finalStreetAddress,
      city: city || '',
      state: state || '',
      zipCode: parsedZip || zipCode // Use parsed zip or fall back to original
    };

    dispatch({ 
      type: 'UPDATE_POSTCARD_DATA', 
      payload: { userInfo }
    });
    dispatch({ type: 'SET_STEP', payload: 5 });
  };

  const goBack = () => {
    dispatch({ type: 'SET_STEP', payload: 3 });
  };

  const isFormComplete = fullName.trim() && streetAddress.trim();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 pb-8 max-w-2xl">
        <Card className="card-warm">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-2xl display-title mb-2">
                Return Address Information
              </h1>
              <p className="body-text text-secondary">
                We need your return address for the postcard so your representative knows it came from a constituent.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    const input = e.target.value;
                    const cursorPosition = e.target.selectionStart;
                    
                    // Capitalize first letter of each word as they type
                    const capitalizedInput = input
                      .split(' ')
                      .map((word, index) => {
                        if (!word) return word;
                        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                      })
                      .join(' ');
                    
                    setFullName(capitalizedInput);
                    
                    // Restore cursor position after state update
                    setTimeout(() => {
                      if (e.target.setSelectionRange) {
                        e.target.setSelectionRange(cursorPosition, cursorPosition);
                      }
                    }, 0);
                  }}
                  placeholder="Enter your full name"
                  className="input-warm h-12 text-base"
                  autoCapitalize="words"
                  autoComplete="name"
                  required
                />
              </div>

              <div className="space-y-2 relative">
                <Label htmlFor="streetAddress">Street Address (for Return Address)*</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground z-10" />
                  <Textarea
                    ref={textareaRef}
                    id="streetAddress"
                    placeholder="Start typing your street address..."
                    value={streetAddress}
                    onChange={(e) => handleAddressInputChange(e.target.value)}
                    onFocus={() => {
                      if (addressSuggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                    className="input-warm pl-10 min-h-[60px] resize-none overflow-hidden text-base"
                    autoComplete="off"
                    required
                    rows={1}
                  />
                </div>
                
                {showSuggestions && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1">
                    <Command className="rounded-xl border border-border shadow-lg bg-background">
                      <CommandList className="max-h-48">
                        {streetAddress.length < 3 ? (
                          <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Keep typing to see address suggestions...
                          </div>
                        ) : isSearching ? (
                          <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
                            Searching addresses...
                          </div>
                        ) : (
                          <>
                            {addressSuggestions.length === 0 ? (
                              <div className="p-3 text-sm text-muted-foreground">
                                No addresses found. Try typing a different address.
                              </div>
                            ) : (
                              addressSuggestions.map((suggestion, index) => {
                                // Remove country from description if present
                                let displayAddress = suggestion.description;
                                if (displayAddress.endsWith(', USA')) {
                                  displayAddress = displayAddress.replace(', USA', '');
                                }
                                
                                return (
                                  <CommandItem
                                    key={suggestion.place_id || index}
                                    onSelect={() => handleSuggestionClick(suggestion)}
                                    className="cursor-pointer hover:bg-accent"
                                  >
                                    <div className="flex items-start gap-2 w-full">
                                      <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                      <div className="flex-1">
                                        <div className="font-medium text-sm">
                                          {suggestion.structured_formatting.main_text}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {displayAddress.replace(suggestion.structured_formatting.main_text + ', ', '')}
                                        </div>
                                      </div>
                                    </div>
                                  </CommandItem>
                                );
                              })
                            )}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </div>
                )}
              </div>

              {!showApartmentField ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowApartmentField(true)}
                  className="text-sm text-muted-foreground hover:text-foreground p-0 h-auto font-normal"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add apartment/unit (optional)
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="apartmentUnit" className="text-sm">Apartment/Unit (Optional)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowApartmentField(false);
                        setApartmentUnit('');
                      }}
                      className="text-sm text-muted-foreground hover:text-foreground p-0 h-auto font-normal"
                    >
                      <Minus className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                  <div className="relative">
                    <Home className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="apartmentUnit"
                      type="text"
                      value={apartmentUnit}
                      onChange={(e) => setApartmentUnit(e.target.value)}
                      placeholder="Apt 5B, Unit 3, Suite 201, etc."
                      className="input-warm pl-10 h-12"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={goBack}
                  className="button-warm h-12"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                
                <Button
                  type="submit"
                  className="flex-1 button-warm h-12"
                  disabled={!isFormComplete}
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}