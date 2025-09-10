// Address parsing utilities for handling user-entered addresses
export interface ParsedAddress {
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  parsed_via: 'google_places' | 'geocodio' | 'regex' | 'fallback';
}

// Simple regex-based address parser as fallback
export function parseAddressRegex(rawText: string): ParsedAddress {
  if (!rawText) {
    return {
      address_line1: '',
      parsed_via: 'fallback'
    };
  }

  // Clean up the input
  const cleaned = rawText.trim();
  
  // Try to match common address patterns
  // Pattern 1: "123 Main St, City, ST 12345"
  const pattern1 = /^([^,]+),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i;
  const match1 = cleaned.match(pattern1);
  
  if (match1) {
    return {
      address_line1: match1[1].trim(),
      city: match1[2].trim(),
      state: match1[3].toUpperCase(),
      postal_code: match1[4],
      country: 'US',
      parsed_via: 'regex'
    };
  }

  // Pattern 2: "123 Main St, City ST 12345"
  const pattern2 = /^([^,]+),\s*(.+)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i;
  const match2 = cleaned.match(pattern2);
  
  if (match2) {
    return {
      address_line1: match2[1].trim(),
      city: match2[2].trim(),
      state: match2[3].toUpperCase(),
      postal_code: match2[4],
      country: 'US',
      parsed_via: 'regex'
    };
  }

  // Pattern 3: Just extract zip code if present
  const zipMatch = cleaned.match(/(\d{5}(?:-\d{4})?)$/);
  if (zipMatch) {
    const addressPart = cleaned.replace(/\s*\d{5}(?:-\d{4})?$/, '');
    return {
      address_line1: addressPart.trim(),
      postal_code: zipMatch[1],
      country: 'US',
      parsed_via: 'regex'
    };
  }

  // Fallback: use the entire string as address_line1
  return {
    address_line1: cleaned,
    parsed_via: 'fallback'
  };
}

// Enhanced parsing with external API integration (placeholder for future implementation)
export async function parseAddressEnhanced(rawText: string, zipCode?: string): Promise<ParsedAddress> {
  // For now, just use regex parsing
  // TODO: Implement Google Places Details API or Geocodio parsing
  return parseAddressRegex(rawText);
}