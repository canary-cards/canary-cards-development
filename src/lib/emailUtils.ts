// Email normalization and validation utilities

// Popular email domains for typo suggestions
const POPULAR_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
  'aol.com', 'icloud.com', 'live.com', 'msn.com', 'mail.com'
];

/**
 * Normalizes an email address by:
 * - Converting to lowercase
 * - Removing everything after + in local part
 * - Removing dots from Gmail local parts
 */
export function normalizeEmail(email: string): string {
  if (!email) return email;
  
  const trimmed = email.toLowerCase().trim();
  const [localPart, domain] = trimmed.split('@');
  
  if (!domain || !localPart) return trimmed;
  
  let normalizedLocal = localPart;
  
  // Remove everything after + in local part
  const plusIndex = normalizedLocal.indexOf('+');
  if (plusIndex > 0) {
    normalizedLocal = normalizedLocal.substring(0, plusIndex);
  }
  
  // For Gmail domains, remove dots from local part
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    normalizedLocal = normalizedLocal.replace(/\./g, '');
  }
  
  return `${normalizedLocal}@${domain}`;
}

/**
 * Enhanced email validation with better regex and domain checking
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;
  
  // More comprehensive email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) return false;
  
  const [localPart, domain] = email.split('@');
  
  // Additional validations
  if (localPart.length > 64) return false; // Local part max length
  if (domain.length > 253) return false; // Domain max length
  if (email.length > 320) return false; // Total max length
  
  return true;
}

/**
 * Suggests corrections for common email domain typos
 */
export function suggestEmailCorrection(email: string): string | null {
  if (!email || !email.includes('@')) return null;
  
  const [localPart, domain] = email.split('@');
  const lowerDomain = domain.toLowerCase();
  
  // Common typo corrections
  const corrections: Record<string, string> = {
    'gmai.com': 'gmail.com',
    'gmial.com': 'gmail.com',
    'gmail.co': 'gmail.com',
    'gmil.com': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'hotmailcom': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'outloo.com': 'outlook.com'
  };
  
  if (corrections[lowerDomain]) {
    return `${localPart}@${corrections[lowerDomain]}`;
  }
  
  // Check for close matches with popular domains
  for (const popularDomain of POPULAR_DOMAINS) {
    if (isTypoOf(lowerDomain, popularDomain)) {
      return `${localPart}@${popularDomain}`;
    }
  }
  
  return null;
}

/**
 * Simple algorithm to detect if one string is likely a typo of another
 */
function isTypoOf(input: string, target: string): boolean {
  if (input === target) return false;
  if (Math.abs(input.length - target.length) > 2) return false;
  
  let differences = 0;
  const maxLength = Math.max(input.length, target.length);
  
  for (let i = 0; i < maxLength; i++) {
    if (input[i] !== target[i]) {
      differences++;
      if (differences > 2) return false;
    }
  }
  
  return differences <= 2 && differences > 0;
}

/**
 * Comprehensive email validation with suggestions
 */
export function validateEmailWithSuggestion(email: string): {
  isValid: boolean;
  suggestion?: string;
  error?: string;
} {
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }
  
  const trimmed = email.trim();
  
  if (!validateEmail(trimmed)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }
  
  const suggestion = suggestEmailCorrection(trimmed);
  if (suggestion && suggestion !== trimmed) {
    return { 
      isValid: true, 
      suggestion,
      error: `Did you mean ${suggestion}?`
    };
  }
  
  return { isValid: true };
}