// Runtime environment configuration selector
// This automatically detects the environment based on hostname

interface EnvironmentConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  frontendUrl: string;
  isProduction: boolean;
  stripePublishableKey: string;
}

const environments: Record<string, EnvironmentConfig> = {
  // Production environment
  'canary.cards': {
    supabaseUrl: 'https://xwsgyxlvxntgpochonwe.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3c2d5eGx2eG50Z3BvY2hvbndlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0ODI4MDEsImV4cCI6MjA2OTA1ODgwMX0.o-Jx0nWkjnOj-61kIaZ5s7UW2gcZa6CFQYUeeqjank8',
    frontendUrl: 'https://canary.cards',
    isProduction: true,
    stripePublishableKey: 'pk_live_51QW85r031...', // TODO: Add production Stripe publishable key
  },
  'www.canary.cards': {
    supabaseUrl: 'https://xwsgyxlvxntgpochonwe.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3c2d5eGx2eG50Z3BvY2hvbndlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0ODI4MDEsImV4cCI6MjA2OTA1ODgwMX0.o-Jx0nWkjnOj-61kIaZ5s7UW2gcZa6CFQYUeeqjank8',
    frontendUrl: 'https://canary.cards',
    isProduction: true,
    stripePublishableKey: 'pk_live_51QW85r031...', // TODO: Add production Stripe publishable key
  },
  // Staging environment
  'lovable.app': {
    supabaseUrl: 'https://pugnjgvdisdbdkbofwrc.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Z25qZ3ZkaXNkYmRrYm9md3JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTM0NzYsImV4cCI6MjA3Mjc2OTQ3Nn0.mCDDS4hIeIatRTlDiGCKnPgdCNFxn6LFK1nkREGMo3s',
    frontendUrl: 'https://lovable.app',
    isProduction: false,
    stripePublishableKey: 'pk_test_51QW85r031IcR46V5cTgJ4dH1ZGGVyqpfgtBu4yE7rPsv9mN5GNTlhpjbK2FkKl5Y4OPR8QClmOgOSzQgbpZi4cLQ004pR7nF7K', // Staging Stripe publishable key
  },
  // Default staging for any other Lovable subdomain
  default: {
    supabaseUrl: 'https://pugnjgvdisdbdkbofwrc.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1Z25qZ3ZkaXNkYmRrYm9md3JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcxOTM0NzYsImV4cCI6MjA3Mjc2OTQ3Nn0.mCDDS4hIeIatRTlDiGCKnPgdCNFxn6LFK1nkREGMo3s',
    frontendUrl: 'https://lovable.app',
    isProduction: false,
    stripePublishableKey: 'pk_test_51QW85r031IcR46V5cTgJ4dH1ZGGVyqpfgtBu4yE7rPsv9mN5GNTlhpjbK2FkKl5Y4OPR8QClmOgOSzQgbpZi4cLQ004pR7nF7K', // Staging Stripe publishable key
  }
};

export function getEnvironmentConfig(): EnvironmentConfig {
  // For server-side rendering or during build, use staging as default
  if (typeof window === 'undefined') {
    return environments.default;
  }

  const hostname = window.location.hostname;
  
  // Check for exact hostname matches
  if (environments[hostname]) {
    return environments[hostname];
  }
  
  // Check if it's a Lovable preview URL (*.lovable.app)
  if (hostname.endsWith('.lovable.app')) {
    return environments.default;
  }
  
  // Default to staging for any unknown domain
  return environments.default;
}

// Convenience getters for the current environment
export const getCurrentEnvironment = () => getEnvironmentConfig();
export const isProduction = () => getEnvironmentConfig().isProduction;
export const getSupabaseUrl = () => getEnvironmentConfig().supabaseUrl;
export const getSupabaseAnonKey = () => getEnvironmentConfig().supabaseAnonKey;
export const getFrontendUrl = () => getEnvironmentConfig().frontendUrl;
export const getStripePublishableKey = () => getEnvironmentConfig().stripePublishableKey;